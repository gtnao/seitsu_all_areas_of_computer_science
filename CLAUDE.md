# Seitsu: All Areas of Computer Science

## Project Overview

This repository contains in-depth technical articles covering all areas of computer science. Articles are written in Markdown and stored in the `docs/` directory.

## Article Writing Guidelines

### Format

- **File format**: Markdown (`.md`)
- **Location**: `docs/` directory
- **Diagrams**: Use Mermaid diagrams for complex visualizations, ASCII art for simple illustrations
- **Minimum length**: 10,000 characters (longer is fine)
- **Code comments**: English
- **Article language**: Japanese

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
