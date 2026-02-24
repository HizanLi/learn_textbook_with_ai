function mockMarkdown(originalName) {
  return `# ${originalName} Overview\n\n## Introduction\n- What this textbook covers\n- How to use this material\n\n## Core Concepts\n- Key idea A\n- Key idea B\n\n## Applications\n- Real-world example 1\n- Real-world example 2\n`;
}

function mockKeypoints(markdown) {
  const sections = [];
  const lines = markdown.split("\n");
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      currentSection = line.replace("# ", "").trim();
      sections.push({ title: currentSection, items: [] });
    } else if (line.startsWith("## ")) {
      const subsection = line.replace("## ", "").trim();
      if (!currentSection) {
        currentSection = "General";
        sections.push({ title: currentSection, items: [] });
      }
      sections[sections.length - 1].items.push({
        id: `${currentSection}-${subsection}`.toLowerCase().replace(/\s+/g, "-"),
        title: subsection,
        keypoints: ["Understand the basics", "Identify key terminology", "Connect to examples"],
      });
    }
  }

  if (sections.length === 0) {
    sections.push({
      title: "Overview",
      items: [{ id: "overview", title: "Main ideas", keypoints: ["Review the core themes"] }],
    });
  }

  return sections;
}

function mockExplanation(title, keypoints = []) {
  return `Explanation for ${title}:\n\n${keypoints.map((k) => `- ${k}`).join("\n")}\n\nThis ties the concepts together with a learner-friendly narrative and examples.`;
}

module.exports = {
  mockMarkdown,
  mockKeypoints,
  mockExplanation,
};