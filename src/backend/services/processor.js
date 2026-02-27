const path = require("path");
const fs = require("fs");
const { readUserStatus, writeUserStatus } = require("./storage");

const PYTHON_API_BASE = process.env.PYTHON_API_BASE || "http://localhost:8000";
const BASE_DIR = path.resolve(__dirname, "..", "..", "..");
const DATA_DIR = path.join(BASE_DIR, "data");

async function processProjectWithPython(username, projectId) {
  try {
    // Get user status to find project details
    const userStatus = readUserStatus(username);
    if (!userStatus) {
      throw new Error("User status not found");
    }

    const project = userStatus.uploadedProjects.find(
      (p) => p.id === projectId
    );
    if (!project) {
      throw new Error("Project not found");
    }

    const userDataDir = path.join(DATA_DIR, username);
    const inputFile = path.join(userDataDir, "input", project.filename);

    console.log(
      `[PROCESS] Starting processing for ${username}/${project.filename}`
    );
    console.log(`[PROCESS] Input file: ${inputFile}`);

    // Check if Python API is available
    try {
      const healthCheck = await fetch(`${PYTHON_API_BASE}/health`, {
        timeout: 2000,
      });
      if (!healthCheck.ok) {
        throw new Error("Python API not responding");
      }
    } catch (err) {
      console.error(
        "[PROCESS] Python API unavailable: " + err.message
      );
      
      // Mark project as failed so it doesn't keep retrying
      const userStatus = readUserStatus(username);
      const project = userStatus?.uploadedProjects?.find(
        (p) => p.id === projectId
      );
      if (project) {
        project.status = "failed";
        project.error = "Python API server is not running";
        writeUserStatus(username, userStatus);
      }
      
      // Return error indicating Python is unavailable instead of fallback
      return {
        success: false,
        message: "Python API server is not running. Please start it with: python src/core/main.py",
        error: "Python API unavailable",
        pythonUnavailable: true,
      };
    }

    // Step 1: Process with MinerU (PDF to Markdown)
    console.log("[PROCESS] Step 1: PDF to Markdown conversion...");
    const minervuRes = await fetch(`${PYTHON_API_BASE}/api/mineru/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        file_name: project.filename,
      }),
    });
    
    const minervuResult = await minervuRes.json();
    
    if (!minervuRes.ok || !minervuResult.success) {
      console.error("[PROCESS] MinerU Response:", minervuRes.status, minervuResult);
      throw new Error(
        `MinerU processing failed: ${minervuResult.detail || minervuResult.message || "Unknown error"}`
      );
    }
    console.log("[PROCESS] Step 1 completed");

    const markdownFile = minervuResult.data?.path || `${project.filename}.md`;

    // Step 2: Chunk the markdown
    console.log("[PROCESS] Step 2: Markdown chunking...");
    const chunkerRes = await fetch(
      `${PYTHON_API_BASE}/api/chunker/process`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          file_name: markdownFile,
          output_filename: `${projectId}-chunks.json`,
        }),
      }
    );
    
    const chunkerResult = await chunkerRes.json();
    
    if (!chunkerRes.ok || !chunkerResult.success) {
      console.error("[PROCESS] Chunker Response:", chunkerRes.status, chunkerResult);
      throw new Error(
        `Chunker processing failed: ${chunkerResult.detail || chunkerResult.message || "Unknown error"}`
      );
    }
    console.log("[PROCESS] Step 2 completed");

    const chunksFile = chunkerResult.data?.path || `${projectId}-chunks.json`;

    // Step 3: Vectorize and store
    console.log("[PROCESS] Step 3: Vectorization and storage...");
    const vectorizationRes = await fetch(
      `${PYTHON_API_BASE}/api/vectorization/store`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          json_path: chunksFile,
          collection_name: `${username}-${projectId}`,
        }),
      }
    );
    
    const vectorizationResult = await vectorizationRes.json();
    
    if (!vectorizationRes.ok || !vectorizationResult.success) {
      console.error("[PROCESS] Vectorization Response:", vectorizationRes.status, vectorizationResult);
      throw new Error(
        `Vectorization failed: ${vectorizationResult.detail || vectorizationResult.message || "Unknown error"}`
      );
    }
    console.log("[PROCESS] Step 3 completed");

    // Update project status to completed
    const updatedStatus = readUserStatus(username);
    const updatedProject = updatedStatus.uploadedProjects.find(
      (p) => p.id === projectId
    );
    if (updatedProject) {
      updatedProject.status = "completed";
      updatedProject.processedAt = new Date().toISOString();
      updatedProject.markdownFile = markdownFile;
      updatedProject.chunksFile = chunksFile;
      updatedProject.collectionName = `${username}-${projectId}`;
      writeUserStatus(username, updatedStatus);
    }

    console.log(`[PROCESS] Processing completed for ${username}/${projectId}`);
    return {
      success: true,
      message: "Project processed successfully",
      project: updatedProject,
    };
  } catch (err) {
    console.error("[PROCESS ERROR]", err);

    // Update project status to failed
    const userStatus = readUserStatus(username);
    const project = userStatus?.uploadedProjects?.find(
      (p) => p.id === projectId
    );
    if (project) {
      project.status = "failed";
      project.error = err.message;
      writeUserStatus(username, userStatus);
    }

    return {
      success: false,
      message: `Processing failed: ${err.message}`,
      error: err.message,
    };
  }
}

function processMockProject(username, projectId, project, userDataDir) {
  try {
    console.log("[PROCESS] Using mock processing (Python API not available)");

    // Create mock markdown content
    const mockMarkdown = `# ${project.originalName}\n\nThis is mock content for development purposes.\n\nTo enable full PDF processing, please start the Python backend:\n\n\`\`\`bash\npython src/core/main.py\n\`\`\`\n\nThe Python API should be running on http://localhost:8000`;

    const mockChunks = {
      chunks: [
        {
          content: mockMarkdown,
          metadata: {
            source: project.originalName,
            header_1: "Mock Content",
            header_2: null,
            header_3: null,
          },
        },
      ],
    };

    // Create output directory if it doesn't exist
    const outputDir = path.join(userDataDir, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save mock markdown
    const markdownPath = path.join(
      outputDir,
      `${project.filename.replace(/\.[^.]+$/, "")}.md`
    );
    fs.writeFileSync(markdownPath, mockMarkdown);

    // Save mock chunks
    const chunksPath = path.join(outputDir, `${projectId}-chunks.json`);
    fs.writeFileSync(chunksPath, JSON.stringify(mockChunks, null, 2));

    // Update project status to completed
    const updatedStatus = readUserStatus(username);
    const updatedProject = updatedStatus.uploadedProjects.find(
      (p) => p.id === projectId
    );
    if (updatedProject) {
      updatedProject.status = "completed";
      updatedProject.processedAt = new Date().toISOString();
      updatedProject.markdownFile = markdownPath;
      updatedProject.chunksFile = chunksPath;
      updatedProject.collectionName = `${username}-${projectId}`;
      updatedProject.isMock = true;
      writeUserStatus(username, updatedStatus);
    }

    console.log(
      `[PROCESS] Mock processing completed for ${username}/${projectId}`
    );
    return {
      success: true,
      message:
        "Project processed with mock data (Python API not available). To enable full processing, start the Python backend.",
      project: updatedProject,
    };
  } catch (err) {
    console.error("[MOCK PROCESS ERROR]", err);
    return {
      success: false,
      message: `Mock processing failed: ${err.message}`,
      error: err.message,
    };
  }
}

function getProjectProcessingStatus(username, projectId) {
  try {
    const userStatus = readUserStatus(username);
    if (!userStatus) {
      return null;
    }

    const project = userStatus.uploadedProjects.find(
      (p) => p.id === projectId
    );
    return project || null;
  } catch (err) {
    console.error("[STATUS ERROR]", err);
    return null;
  }
}

module.exports = {
  processProjectWithPython,
  getProjectProcessingStatus,
  PYTHON_API_BASE,
};
