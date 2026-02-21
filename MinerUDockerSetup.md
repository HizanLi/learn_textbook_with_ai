既然你已经成功打通了从 Docker 部署到 HTTP 接口访问的全链路，这里我为你整理了一份完整的 **`MinerU Docker Setup Guide`**。你可以直接把这段内容保存为 `README.md`。

---

# MinerU Docker 部署与 API 集成指南 (Windows WSL2 版)

本指南适用于在 Windows 11 环境下，利用 WSL2 (Ubuntu) 和 NVIDIA GPU (如 RTX 3080 Ti) 部署 MinerU PDF 解析引擎。

## 🛠 环境准备

* **系统**: Windows 11 + WSL2 (Ubuntu 22.04+)
* **硬件**: NVIDIA GPU (建议显存  8GB), 内存  16GB
* **软件**:
* Docker Desktop (开启 **WSL Integration**)
* NVIDIA Container Toolkit (通常 Docker Desktop 已内置)



## 📂 目录结构建议

在 Windows (如 D 盘) 创建以下目录用于数据交换：

* `D:\mineru_test\input`: 存放待解析的 PDF
* `D:\mineru_test\output`: 存放解析后的 Markdown 和图片

---

## 🚀 部署步骤

### 1. 构建 Docker 镜像

在 WSL2 (Ubuntu) 终端执行：

```bash
mkdir ~/mineru_work && cd ~/mineru_work
# 下载官方 Dockerfile
wget https://gcore.jsdelivr.net/gh/opendatalab/MinerU@master/docker/global/Dockerfile
# 构建镜像
docker build -t mineru:latest -f Dockerfile .

```

### 2. 启动容器 (映射端口与挂载目录)

使用以下命令启动容器。注意 `-p` 用于打开 API 端口，`-v` 用于挂载 Windows 目录：

```bash
docker run --gpus all \
  --shm-size 32g \
  -v /mnt/d/mineru_test/input:/app/input \
  -v /mnt/d/mineru_test/output:/app/output \
  -p 8000:8000 \
  --ipc=host \
  -it mineru:latest /bin/bash
  
  实验是否安装成功
  mineru -p /app/input/***.pdf -o /app/output

```

### 3. 开启 HTTP API 服务

进入容器后，执行以下命令开启外部可访问的 API 服务：

```bash
python3 -m mineru.cli.fast_api --host 0.0.0.0 --port 8000

```

> **提示**: 必须指定 `--host 0.0.0.0`，否则 Windows 宿主机无法访问容器内的服务。

---

## 🔗 API 验证与使用

### 1. 验证接口

在 Windows 浏览器访问：
[http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs)
看到 **FastAPI Swagger UI** 界面即代表部署成功。

### 2. Python 客户端调用示例

在 Windows 环境下使用 `requests` 库调用：

```python
import requests

def parse_pdf(pdf_path):
    url = "http://localhost:8000/file_parse"
    payload = {
        "output_dir": "/app/output", # Docker 内部挂载路径
        "formula_enable": True,      # 开启公式识别
        "return_md": True            # 直接返回 Markdown 内容
    }
    files = [('files', (open(pdf_path, 'rb')))]
    
    response = requests.post(url, data=payload, files=files)
    return response.json()

# 使用示例
# result = parse_pdf(r"D:\mineru_test\input\test.pdf")
# print(result['data']['md_content'])

```

---

## 💡 注意事项

* **显存管理**: 3080 Ti (12GB) 在解析大型 PDF 时会占用约 8-10GB 显存。若需同时运行 Ollama 大模型，建议先完成解析再启动 LLM。
* **WSL IP**: 若 `localhost` 无法访问，请在 PowerShell 运行 `wsl hostname -I` 获取 WSL 真实 IP 进行访问。

---

**这份文档已经涵盖了你过去两小时踩过的所有坑。**

**接下来你想让我帮你写“出题引擎”部分的 Python 代码吗？我们可以尝试让 AI 读入这些 Markdown，然后针对每个章节自动出 5 道选择题。**