# Seitsu: All Areas of Computer Science

## IMPORTANT: Language Rules

- **CRITICAL: All articles MUST be written entirely in Japanese.** This is a Japanese-language technical article repository. Every heading, paragraph, explanation, and description must be in Japanese. The only exceptions are:
  - Technical terms that are conventionally written in English (e.g., B-Tree, TCP, API, mutex)
  - Code snippets and their inline comments (English)
  - Mermaid diagram labels (may use English for technical terms where appropriate)
- Do NOT write articles in English. Do NOT mix English prose into Japanese articles. When in doubt, write in Japanese.

## Project Overview

コンピューターサイエンスの全領域をカバーする、深い技術解説記事を収めるリポジトリ。記事はMarkdown形式で `docs/` ディレクトリに配置する。

## Article Writing Guidelines

### Format

- **File format**: Markdown (`.md`)
- **Location**: `docs/` directory
- **Diagrams**: Use Mermaid diagrams for complex visualizations, ASCII art for simple illustrations
- **Math**: Use TeX notation (`$...$` for inline, `$$...$$` for display) for mathematical expressions when the topic involves mathematical concepts (e.g., cryptography, algorithms, information theory)
- **Minimum length**: 10,000 characters (longer is fine)
- **Language**: **Japanese** (see IMPORTANT section above)
- **Code comments**: English

### Front Matter

Every article must include YAML front matter with tags:

```yaml
---
title: "Article Title"
date: YYYY-MM-DD
tags: ["tag1", "tag2", "tag3"]
---
```

Tags should include:
- The primary CS area (e.g., `algorithms`, `operating-systems`, `networking`, `databases`, `compilers`, `distributed-systems`, `security`, `machine-learning`, `computer-architecture`, `programming-languages`, `theory-of-computation`, `software-engineering`)
- Specific sub-topics (e.g., `sorting`, `virtual-memory`, `tcp`, `b-tree`, `garbage-collection`)
- Difficulty level: `introductory`, `intermediate`, or `advanced`

### Writing Philosophy

- Emphasize **essential understanding**: clarify *why* it exists and *what problem* it solves
- Balance theoretical background with implementation details
- Include historical context and design philosophy when relevant
- Use Mermaid diagrams where visual explanation is effective
- Keep code examples minimal — just enough to illustrate key points
- Discuss real-world adoption, pros/cons, and alternatives
- Be honest about technical trade-offs and practical constraints

### Article Structure Templates

#### Theoretical Topics
1. Background / Motivation
2. Definitions
3. Principles / Proofs
4. Practical Significance
5. Limitations and Future Directions

#### Implementation Techniques
1. Problem Statement
2. Solution Approach
3. Technical Details
4. Implementation Considerations
5. Real-world Evaluation

#### System Concepts
1. Historical Background
2. Architecture
3. Implementation Methods
4. Operational Reality
5. Future Outlook

### File Naming Convention

Use kebab-case with descriptive names:
```
docs/b-tree.md
docs/tcp-congestion-control.md
docs/raft-consensus.md
docs/garbage-collection.md
```

## Workflow

### After writing an article:
1. Commit with a descriptive message (e.g., `docs: add article on B-tree indexing`)
2. Push to remote

### Commit Message Format
```
docs: add article on <topic>
docs: update article on <topic>
```
