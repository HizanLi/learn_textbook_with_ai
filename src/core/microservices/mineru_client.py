import os
import subprocess
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

class MinerUClient:
    def __init__(self):
        load_dotenv()
        self.data_dir = Path(os.getenv("DATA_DIR")) if os.getenv("DATA_DIR") else None
        self.image_name = "mineru:latest"
        self.container_id = self._get_container_id()

    def _get_container_id(self):
        try:
            cmd = f'docker ps -f "ancestor={self.image_name}" -f "status=running" -q'
            container_id = subprocess.check_output(cmd, shell=True).decode().strip()
            if not container_id:
                return None
            return container_id
        except Exception:
            return None

    def check_health(self):
        """
        检查 Docker 容器及其内部环境的健康状态
        - 检查容器是否运行
        - 检查容器内 mineru 命令是否可用
        """
        self.container_id = self._get_container_id()
        if not self.container_id:
            return {
                "status": "unavailable",
                "message": f"Docker 容器 '{self.image_name}' 未启动",
                "container_id": None
            }
        
        try:
            # 检查容器内 mineru 命令是否可用
            cmd = f'docker exec {self.container_id} mineru --version'
            version_info = subprocess.check_output(cmd, shell=True).decode().strip()
            return {
                "status": "ready",
                "message": "MinerU 容器正常运行",
                "container_id": self.container_id,
                "version": version_info
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"容器运行中但 MinerU 命令执行失败: {str(e)}",
                "container_id": self.container_id
            }

    def _to_container_path(self, host_path: Path) -> Optional[str]:
        if not self.data_dir:
            return None
        try:
            host_abs = host_path.resolve()
            data_abs = self.data_dir.resolve()
            relative = host_abs.relative_to(data_abs)
            return f"/app/data/{relative.as_posix()}"
        except Exception:
            return None

    def process_file(self, username: str, file_name: str):
        """
        处理 PDF 文件并返回统一格式
        :param username: 用户名，用于拼接 DATA_DIR/{username}
        :param file_name: PDF 文件名
        返回格式: {"success": bool, "status_code": int, "message": str, "data": dict}
        """
        if not self.data_dir:
            return {
                "success": False,
                "status_code": 500,
                "message": "DATA_DIR 未配置",
                "data": None,
            }

        user_root = self.data_dir / username
        user_input_path = user_root / "input"
        user_output_path = user_root / "output"
        user_output_path.mkdir(parents=True, exist_ok=True)

        self.container_id = self._get_container_id()
        
        # 1. 检查容器状态
        if not self.container_id:
            return {
                "success": False, 
                "status_code": 503, 
                "message": f"Docker 容器 '{self.image_name}' 未启动", 
                "data": None
            }

        # 2. 检查输入文件
        local_file_path = user_input_path / file_name
        if not local_file_path.exists():
            return {
                "success": False, 
                "status_code": 404, 
                "message": f"输入文件不存在: {local_file_path}", 
                "data": None
            }

        container_input_path = self._to_container_path(local_file_path)
        container_output_path = self._to_container_path(user_output_path)
        if not container_input_path or not container_output_path:
            return {
                "success": False,
                "status_code": 400,
                "message": f"路径不在 DATA_DIR 下，无法映射到容器: input={local_file_path}, output={user_output_path}, DATA_DIR={self.data_dir}",
                "data": None,
            }

        # 3. 幂等性检查（检查是否已转换）
        stem_name = Path(file_name).stem
        target_output_path = user_output_path / stem_name
        if target_output_path.exists() and any(target_output_path.iterdir()):
            return {
                "success": True, 
                "status_code": 200, 
                "message": "文件已存在，跳过转换", 
                "data": {"path": str(target_output_path), "status": "existed"}
            }

        # 4. 构造并执行指令
        docker_cmd = [
            "docker", "exec", self.container_id,
            "mineru", "-p", container_input_path, "-o", container_output_path
        ]

        try:
            print(f"🚀 正在处理: {file_name}")
            result = subprocess.run(docker_cmd, capture_output=True, text=True, encoding='utf-8')

            if result.returncode == 0:
                return {
                    "success": True, 
                    "status_code": 200, 
                    "message": "解析成功", 
                    "data": {"path": str(target_output_path), "status": "processed"}
                }
            else:
                return {
                    "success": False, 
                    "status_code": 500, 
                    "message": f"容器内解析出错: {result.stderr.strip()}", 
                    "data": None
                }
        except Exception as e:
            return {
                "success": False, 
                "status_code": 500, 
                "message": f"系统运行异常: {str(e)}", 
                "data": None
            }

# if __name__ == "__main__":
#     client = MinerUClient()
#     # 模拟后端调用
#     # response = client.process_file("python.pdf")
    
#     # if response["success"]:
#     #     print(f"处理成功 [{response['status_code']}]: {response['message']}")
#     #     print(f"数据详情: {response['data']}")
#     # else:
#     #     print(f"处理失败 [{response['status_code']}]: {response['message']}")
    

#     response = client.process_file("hizan", "1Lemoine.pdf")
#     print(response)