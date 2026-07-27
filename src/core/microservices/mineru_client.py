import filecmp
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:  # Keep the API available and return an actionable setup error.
    PdfReader = None
    PdfWriter = None


class MinerUClient:
    def __init__(self):
        load_dotenv()
        repository_root = Path(__file__).resolve().parents[3]
        configured_data_dir = os.getenv("DATA_DIR", "data")
        configured_path = Path(configured_data_dir).expanduser()
        self.data_dir = configured_path if configured_path.is_absolute() else repository_root / configured_path
        self.image_name = "mineru:latest"
        self.part_pages = self._read_part_pages()
        self.keep_raw_output = os.getenv("MINERU_KEEP_RAW_OUTPUT", "").strip().lower() in {"1", "true", "yes"}
        self.container_id = self._get_container_id()

    @staticmethod
    def _read_part_pages() -> int:
        try:
            return max(1, int(os.getenv("MINERU_PDF_PART_PAGES", "120")))
        except ValueError:
            return 120

    def _get_container_id(self):
        try:
            cmd = f'docker ps -f "ancestor={self.image_name}" -f "status=running" -q'
            container_id = subprocess.check_output(cmd, shell=True).decode().strip()
            return container_id or None
        except Exception:
            return None

    def check_health(self):
        """Check whether the configured MinerU Docker container is ready."""
        self.container_id = self._get_container_id()
        if not self.container_id:
            return {
                "status": "unavailable",
                "message": f"Docker container '{self.image_name}' is not running",
                "container_id": None,
            }

        try:
            cmd = f"docker exec {self.container_id} mineru --version"
            version_info = subprocess.check_output(cmd, shell=True).decode().strip()
            return {
                "status": "ready",
                "message": "MinerU container is ready",
                "container_id": self.container_id,
                "version": version_info,
            }
        except Exception as error:
            return {
                "status": "error",
                "message": f"MinerU command failed in the container: {error}",
                "container_id": self.container_id,
            }

    def _to_container_path(self, host_path: Path) -> Optional[str]:
        if not self.data_dir:
            return None
        try:
            relative = host_path.resolve().relative_to(self.data_dir.resolve())
            return f"/app/data/{relative.as_posix()}"
        except ValueError:
            return None

    def _run_mineru(self, input_path: Path, output_path: Path) -> Tuple[bool, str]:
        container_input_path = self._to_container_path(input_path)
        container_output_path = self._to_container_path(output_path)
        if not container_input_path or not container_output_path:
            return False, "Input or output path cannot be mapped into the MinerU container"

        result = subprocess.run(
            [
                "docker",
                "exec",
                self.container_id,
                "env",
                "VLLM_USE_V1=1",
                "mineru",
                "-p",
                container_input_path,
                "-o",
                container_output_path,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode == 0:
            return True, result.stdout.strip()
        return False, result.stderr.strip() or result.stdout.strip() or "MinerU exited with an error"

    @staticmethod
    def _find_markdown(output_root: Path, input_stem: str) -> Optional[Path]:
        exact_matches = sorted(output_root.rglob(f"{input_stem}.md"))
        if exact_matches:
            return exact_matches[0]
        markdown_files = sorted(output_root.rglob("*.md"))
        return markdown_files[0] if markdown_files else None

    def _split_pdf(
        self,
        source_pdf: Path,
        parts_root: Path,
        page_count: int,
        output_parts_root: Optional[Path] = None,
    ) -> List[Dict]:
        if PdfReader is None or PdfWriter is None:
            raise RuntimeError("pypdf is required for large PDFs. Install the core requirements first.")

        parts_root.mkdir(parents=True, exist_ok=True)
        reader = PdfReader(str(source_pdf))
        parts = []
        for index, start_index in enumerate(range(0, page_count, self.part_pages), start=1):
            end_index = min(start_index + self.part_pages, page_count)
            part_dir = parts_root / f"part_{index:03d}"
            output_part_dir = (output_parts_root or parts_root) / f"part_{index:03d}"
            part_dir.mkdir(parents=True, exist_ok=True)
            output_part_dir.mkdir(parents=True, exist_ok=True)
            part_path = part_dir / f"{source_pdf.stem}_part_{index:03d}.pdf"
            if not part_path.exists():
                writer = PdfWriter()
                for page_index in range(start_index, end_index):
                    writer.add_page(reader.pages[page_index])
                with part_path.open("wb") as part_file:
                    writer.write(part_file)

            parts.append(
                {
                    "index": index,
                    "start_page": start_index + 1,
                    "end_page": end_index,
                    "pdf_path": part_path,
                    "part_dir": part_dir,
                    "output_part_dir": output_part_dir,
                }
            )
        return parts

    def _source_pdf_path(self, username: str, file_name: str) -> Path:
        """Prefer the per-file input directory, with support for pre-migration uploads."""
        safe_name = Path(file_name).name
        project_name = Path(safe_name).stem
        input_root = self.data_dir / username / "input"
        nested_path = input_root / project_name / safe_name
        if nested_path.exists():
            return nested_path
        nested_path = input_root / safe_name / safe_name
        if nested_path.exists():
            return nested_path
        return input_root / safe_name

    def _parts_root(self, username: str, file_name: str) -> Path:
        safe_name = Path(file_name).name
        return self.data_dir / username / "input" / Path(safe_name).stem

    def _output_parts_root(self, username: str, file_name: str) -> Path:
        safe_name = Path(file_name).name
        return self.data_dir / username / "output" / Path(safe_name).stem

    def _canonicalize_source_pdf(self, source_pdf: Path) -> Path:
        """Move a legacy flat upload into its per-file input directory before splitting."""
        if source_pdf.parent.name == source_pdf.stem:
            return source_pdf

        if source_pdf.parent.name == "input":
            input_root = source_pdf.parent
            canonical_path = input_root / source_pdf.stem / source_pdf.name
        elif source_pdf.parent.parent.name == "input":
            input_root = source_pdf.parent.parent
            canonical_path = input_root / source_pdf.stem / source_pdf.name
        else:
            canonical_path = source_pdf.parent / source_pdf.stem / source_pdf.name
        if canonical_path.exists():
            return canonical_path

        canonical_path.parent.mkdir(parents=True, exist_ok=True)
        source_pdf.replace(canonical_path)
        return canonical_path

    @staticmethod
    def _part_markdown_path(part: Dict) -> Path:
        return part.get("output_part_dir", part["part_dir"]) / f"{part['pdf_path'].stem}.md"

    def _store_part_markdown(self, markdown_path: Path, part: Dict) -> Path:
        """Keep each converted part self-contained in the output part directory."""
        stored_markdown_path = self._part_markdown_path(part)
        markdown = markdown_path.read_text(encoding="utf-8")

        source_images_dir = markdown_path.parent / "images"
        target_images_dir = stored_markdown_path.parent / "images"
        if source_images_dir.exists():
            if target_images_dir.exists():
                shutil.rmtree(target_images_dir)
            shutil.copytree(source_images_dir, target_images_dir)

        header = f"<!-- Source PDF pages {part['start_page']}-{part['end_page']} -->"
        temporary_path = stored_markdown_path.with_suffix(".md.tmp")
        temporary_path.write_text(f"{header}\n\n{markdown.strip()}\n", encoding="utf-8")
        temporary_path.replace(stored_markdown_path)
        return stored_markdown_path

    def _cleanup_raw_part_output(self, part_output_root: Path) -> None:
        if self.keep_raw_output or not part_output_root.exists():
            return

        try:
            shutil.rmtree(part_output_root)
        except Exception as error:
            print(f"Unable to remove raw MinerU output {part_output_root}: {error}")

    def _update_part_statuses(
        self,
        username: str,
        file_name: str,
        parts: List[Dict],
        converted_part_index: Optional[int] = None,
        active_part_index: Optional[int] = None,
        failed_part_index: Optional[int] = None,
    ) -> None:
        """Persist split-part progress without making conversion depend on UI metadata."""
        status_path = self.data_dir / username / "user_status.json"
        if not status_path.exists():
            return

        try:
            status_data = json.loads(status_path.read_text(encoding="utf-8"))
            project = next(
                (
                    item
                    for item in status_data.get("uploadedProjects", [])
                    if item.get("filename") == file_name or item.get("originalName") == file_name
                ),
                None,
            )
            if not project:
                return

            previous_statuses = project.get("parts", {})
            project["parts"] = {
                f"part_number{part['index']}": (
                    "converted"
                    if part["index"] == converted_part_index
                    or previous_statuses.get(f"part_number{part['index']}") == "converted"
                    else "failed"
                    if part["index"] == failed_part_index
                    else "processing"
                    if part["index"] == active_part_index
                    else "uploaded"
                )
                for part in parts
            }
            converted_count = sum(1 for status in project["parts"].values() if status == "converted")
            active_part = next((part for part in parts if part["index"] == active_part_index), None)
            failed_part = next((part for part in parts if part["index"] == failed_part_index), None)
            project["splitProcessing"] = {
                "status": (
                    "failed"
                    if failed_part_index
                    else "completed"
                    if parts and converted_count == len(parts)
                    else "processing"
                    if active_part_index
                    else "idle"
                ),
                "pageCount": parts[-1]["end_page"] if parts else None,
                "partCount": len(parts),
                "convertedCount": converted_count,
                "currentPart": active_part_index,
                "currentStartPage": active_part["start_page"] if active_part else None,
                "currentEndPage": active_part["end_page"] if active_part else None,
                "failedPart": failed_part_index,
                "failedStartPage": failed_part["start_page"] if failed_part else None,
                "failedEndPage": failed_part["end_page"] if failed_part else None,
            }
            temporary_path = status_path.with_suffix(".json.tmp")
            temporary_path.write_text(json.dumps(status_data, indent=2), encoding="utf-8")
            temporary_path.replace(status_path)
        except Exception as error:
            print(f"Unable to update split-part status: {error}")

    @staticmethod
    def _merge_part_images(markdown: str, part_output_dir: Path, final_output_dir: Path, part_index: int) -> str:
        source_images_dir = part_output_dir / "images"
        if not source_images_dir.exists():
            return markdown

        target_images_dir = final_output_dir / "images"
        target_images_dir.mkdir(parents=True, exist_ok=True)
        replacements = {}

        for image_path in source_images_dir.rglob("*"):
            if not image_path.is_file():
                continue

            relative_name = image_path.relative_to(source_images_dir).as_posix()
            target_path = target_images_dir / relative_name
            replacement_name = relative_name
            if target_path.exists() and not filecmp.cmp(image_path, target_path, shallow=False):
                replacement_name = f"part_{part_index:03d}_{image_path.name}"
                target_path = target_images_dir / replacement_name

            target_path.parent.mkdir(parents=True, exist_ok=True)
            if not target_path.exists():
                shutil.copy2(image_path, target_path)
            replacements[f"images/{relative_name}"] = f"images/{replacement_name}"

        for original, replacement in replacements.items():
            markdown = markdown.replace(original, replacement)
        return markdown

    def _merge_markdown_parts(
        self,
        part_records: List[Dict],
        final_output_dir: Path,
        project_stem: str,
    ) -> Path:
        final_output_dir.mkdir(parents=True, exist_ok=True)
        merged_markdown_path = final_output_dir / f"{project_stem}.md"
        combined_parts = []

        for record in part_records:
            markdown_path = record["markdown_path"]
            markdown = markdown_path.read_text(encoding="utf-8")
            markdown = self._merge_part_images(
                markdown,
                markdown_path.parent,
                final_output_dir,
                record["index"],
            )
            markdown = markdown.strip()
            if not markdown.startswith("<!-- Source PDF pages "):
                markdown = f"<!-- Source PDF pages {record['start_page']}-{record['end_page']} -->\n\n{markdown}"
            combined_parts.append(markdown)

        temporary_path = merged_markdown_path.with_suffix(".md.tmp")
        temporary_path.write_text("\n\n".join(combined_parts) + "\n", encoding="utf-8")
        temporary_path.replace(merged_markdown_path)
        return merged_markdown_path

    def _write_split_manifest(
        self,
        parts_root: Path,
        page_count: int,
        parts: List[Dict],
        markdown_path: Optional[Path] = None,
    ):
        manifest = {
            "page_count": page_count,
            "pages_per_part": self.part_pages,
            "merged_markdown": str(markdown_path) if markdown_path else None,
            "parts": [
                {
                    "index": part["index"],
                    "start_page": part["start_page"],
                    "end_page": part["end_page"],
                    "pdf_path": str(part["pdf_path"]),
                    "output_part_dir": str(part["output_part_dir"]) if part.get("output_part_dir") else None,
                    "markdown_path": str(part["markdown_path"]) if part.get("markdown_path") else None,
                }
                for part in parts
            ],
        }
        manifest_path = parts_root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    def prepare_file(self, username: str, file_name: str):
        """Count PDF pages and create part PDFs immediately after upload."""
        if not self.data_dir:
            return {"success": False, "status_code": 500, "message": "DATA_DIR is not configured", "data": None}
        if PdfReader is None:
            return {
                "success": False,
                "status_code": 500,
                "message": "pypdf is not installed. Install the core Python requirements.",
                "data": None,
            }

        user_root = self.data_dir / username
        source_pdf = self._source_pdf_path(username, file_name)
        if not source_pdf.exists():
            return {"success": False, "status_code": 404, "message": f"Input file does not exist: {source_pdf}", "data": None}

        source_pdf = self._canonicalize_source_pdf(source_pdf)

        try:
            page_count = len(PdfReader(str(source_pdf)).pages)
        except Exception as error:
            return {"success": False, "status_code": 400, "message": f"Unable to read PDF pages: {error}", "data": None}

        if page_count <= self.part_pages:
            return {
                "success": True,
                "status_code": 200,
                "message": "PDF does not need splitting",
                "data": {"page_count": page_count, "part_count": 1, "split": False},
            }

        try:
            parts_root = self._parts_root(username, source_pdf.name)
            output_parts_root = self._output_parts_root(username, source_pdf.name)
            parts = self._split_pdf(source_pdf, parts_root, page_count, output_parts_root)
            self._update_part_statuses(username, source_pdf.name, parts)
            self._write_split_manifest(parts_root, page_count, parts)
            return {
                "success": True,
                "status_code": 200,
                "message": "PDF split into parts and queued for MinerU",
                "data": {
                    "page_count": page_count,
                    "part_count": len(parts),
                    "split": True,
                    "parts_path": str(parts_root),
                },
            }
        except Exception as error:
            return {"success": False, "status_code": 500, "message": f"Failed to split PDF: {error}", "data": None}

    def _process_split_pdf(
        self,
        username: str,
        source_pdf: Path,
        project_dir: Path,
        page_count: int,
    ) -> Tuple[bool, str, Optional[Path], List[Dict]]:
        parts_root = self._parts_root(username, source_pdf.name)
        output_parts_root = self._output_parts_root(username, source_pdf.name)
        final_output_dir = project_dir / "hybrid_auto"
        parts = self._split_pdf(source_pdf, parts_root, page_count, output_parts_root)
        self._update_part_statuses(username, source_pdf.name, parts)

        for part in parts:
            stored_markdown_path = self._part_markdown_path(part)
            if stored_markdown_path.exists() and stored_markdown_path.stat().st_size > 0:
                part["markdown_path"] = stored_markdown_path
                self._update_part_statuses(username, source_pdf.name, parts, part["index"])
                continue

            part_output_root = part["output_part_dir"] / "mineru_output"
            part_stem = part["pdf_path"].stem
            markdown_path = self._find_markdown(part_output_root, part_stem)
            if not markdown_path:
                part_output_root.mkdir(parents=True, exist_ok=True)
                self._update_part_statuses(username, source_pdf.name, parts, active_part_index=part["index"])
                success, message = self._run_mineru(part["pdf_path"], part_output_root)
                if not success:
                    self._update_part_statuses(username, source_pdf.name, parts, failed_part_index=part["index"])
                    return False, f"Part {part['index']} ({part['start_page']}-{part['end_page']}) failed: {message}", None, parts
                markdown_path = self._find_markdown(part_output_root, part_stem)
                if not markdown_path:
                    self._update_part_statuses(username, source_pdf.name, parts, failed_part_index=part["index"])
                    return False, f"Part {part['index']} completed but no Markdown output was found", None, parts
            part["markdown_path"] = self._store_part_markdown(markdown_path, part)
            self._cleanup_raw_part_output(part_output_root)
            self._update_part_statuses(username, source_pdf.name, parts, part["index"])

        merged_markdown_path = self._merge_markdown_parts(parts, final_output_dir, source_pdf.stem)
        self._write_split_manifest(parts_root, page_count, parts, merged_markdown_path)
        return True, "Large PDF split, processed, and merged successfully", merged_markdown_path, parts

    def process_file(self, username: str, file_name: str):
        """Convert one PDF, splitting large documents before MinerU processing."""
        if not self.data_dir:
            return {"success": False, "status_code": 500, "message": "DATA_DIR is not configured", "data": None}
        if PdfReader is None:
            return {
                "success": False,
                "status_code": 500,
                "message": "pypdf is not installed. Install the core Python requirements.",
                "data": None,
            }

        user_root = self.data_dir / username
        source_pdf = self._source_pdf_path(username, file_name)
        project_dir = user_root / "output" / Path(file_name).stem
        final_markdown = project_dir / "hybrid_auto" / f"{Path(file_name).stem}.md"
        if not source_pdf.exists():
            return {"success": False, "status_code": 404, "message": f"Input file does not exist: {source_pdf}", "data": None}

        if final_markdown.exists() and final_markdown.stat().st_size > 0:
            return {
                "success": True,
                "status_code": 200,
                "message": "Converted Markdown already exists; skipping processing",
                "data": {"path": str(project_dir), "status": "existed"},
            }

        preparation = self.prepare_file(username, file_name)
        if not preparation["success"]:
            return preparation
        page_count = preparation["data"]["page_count"]
        source_pdf = self._source_pdf_path(username, file_name)

        self.container_id = self._get_container_id()
        if not self.container_id:
            return {
                "success": False,
                "status_code": 503,
                "message": f"Docker container '{self.image_name}' is not running",
                "data": None,
            }

        if page_count <= self.part_pages:
            project_dir.parent.mkdir(parents=True, exist_ok=True)
            success, message = self._run_mineru(source_pdf, project_dir.parent)
            if not success:
                return {"success": False, "status_code": 500, "message": message, "data": None}
            return {
                "success": True,
                "status_code": 200,
                "message": "PDF processed successfully",
                "data": {"path": str(project_dir), "status": "processed", "page_count": page_count, "part_count": 1},
            }

        try:
            success, message, markdown_path, parts = self._process_split_pdf(
                username,
                source_pdf,
                project_dir,
                page_count,
            )
        except Exception as error:
            return {"success": False, "status_code": 500, "message": f"Failed to split PDF: {error}", "data": None}

        if not success:
            return {"success": False, "status_code": 500, "message": message, "data": None}
        return {
            "success": True,
            "status_code": 200,
            "message": message,
            "data": {
                "path": str(project_dir),
                "markdown_path": str(markdown_path),
                "status": "processed",
                "page_count": page_count,
                "part_count": len(parts),
            },
        }
