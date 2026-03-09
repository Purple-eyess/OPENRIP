# Excalidraw Visuals Skill

Generate hand-drawn Excalidraw-style PNG diagrams using AI. Just describe what you want and Claude builds a structured prompt, generates the image, and saves it to your project.

Costs ~$0.02-0.09 per image via Nano Banana (kie.ai).

## Setup

### 1. Get your API key

Sign up at [kie.ai](https://kie.ai) and grab your API key from the settings page.

### 2. Copy files into your project

Copy the contents of this folder into your Claude Code project root. The folder structure mirrors exactly where files need to land:

```
your-project/
  .claude/skills/excalidraw-visuals/
    SKILL.md              <-- skill instructions
    style-guide.md        <-- visual specification
  scripts/excalidraw-visuals/
    generate-visual.js    <-- generation script
  brand-assets/
    excalidraw-style-reference.png  <-- style anchor image
  .env                    <-- your API key (see step 3)
```

### 3. Add your API key

Copy `.env.example` to `.env` in your project root (or add the line to your existing `.env`):

```
KIE_AI_API_KEY=your-actual-key-here
```

### 4. Make sure Node.js is installed

The generation script runs on Node.js. Any recent version works (18+).

## Usage

Once set up, just ask Claude:

- "Make me an excalidraw visual of how API authentication works"
- "Excalidraw image showing the CI/CD pipeline"
- "Hand-drawn diagram of a RAG system"

Claude will:
1. Ask clarifying questions if needed
2. Pick a layout template
3. Plan minimal text labels
4. Build a structured prompt with the locked style prefix
5. Generate the image and save it to `projects/excalidraw-visuals/`

## Customization

### Style reference image
The included `excalidraw-style-reference.png` defines the visual style. To create your own:
1. Generate a visual you like
2. Save it as your new style reference
3. Replace `brand-assets/excalidraw-style-reference.png`

All future generations will match your new reference.

### Additional reference images
You can pass logos, screenshots, or other images to the generator. Claude handles this automatically when relevant, or you can ask: "Include my logo in the visual."

### Aspect ratios
- `16:9` -- default, good for presentations and YouTube
- `1:1` -- square, good for social media
- `4:5` -- portrait, good for LinkedIn/Instagram
