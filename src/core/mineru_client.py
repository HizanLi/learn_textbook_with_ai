import os
import subprocess
from pathlib import Path
from dotenv import load_dotenv

class MinerUClient:
    def __init__(self):
        load_dotenv()
        self.input_dir = Path(os.getenv("INPUT_DIR"))
        self.output_dir = Path(os.getenv("OUTPUT_DIR"))
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

    def process_file(self, file_name):
        """
        处理 PDF 文件并返回统一格式
        返回格式: {"success": bool, "code": int, "message": str, "data": dict}
        """
        # 1. 检查容器状态
        if not self.container_id:
            return {
                "success": False, 
                "code": 503, 
                "message": f"Docker 容器 '{self.image_name}' 未启动", 
                "data": None
            }

        # 2. 检查输入文件
        local_file_path = self.input_dir / file_name
        if not local_file_path.exists():
            return {
                "success": False, 
                "code": 404, 
                "message": f"输入文件不存在: {local_file_path}", 
                "data": None
            }

        # 3. 幂等性检查（检查是否已转换）
        stem_name = Path(file_name).stem
        target_output_path = self.output_dir / stem_name
        if target_output_path.exists() and any(target_output_path.iterdir()):
            return {
                "success": True, 
                "code": 200, 
                "message": "文件已存在，跳过转换", 
                "data": {"path": str(target_output_path), "status": "existed"}
            }

        # 4. 构造并执行指令
        docker_cmd = [
            "docker", "exec", self.container_id,
            "mineru", "-p", f"/app/input/{file_name}", "-o", "/app/output"
        ]

        try:
            print(f"🚀 正在处理: {file_name}")
            result = subprocess.run(docker_cmd, capture_output=True, text=True, encoding='utf-8')

            if result.returncode == 0:
                return {
                    "success": True, 
                    "code": 200, 
                    "message": "解析成功", 
                    "data": {"path": str(target_output_path), "status": "processed"}
                }
            else:
                return {
                    "success": False, 
                    "code": 500, 
                    "message": f"容器内解析出错: {result.stderr.strip()}", 
                    "data": None
                }
        except Exception as e:
            return {
                "success": False, 
                "code": 500, 
                "message": f"系统运行异常: {str(e)}", 
                "data": None
            }

if __name__ == "__main__":
    client = MinerUClient()
    # 模拟后端调用
    response = client.process_file("test.pdf")
    
    if response["success"]:
        print(f"处理成功 [{response['code']}]: {response['message']}")
        print(f"数据详情: {response['data']}")
    else:
        print(f"处理失败 [{response['code']}]: {response['message']}")