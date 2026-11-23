# Puzzle Book Generator

A printable saddle-stitch pocket puzzle booklet maker with procedural on-the-fly generators (**Sudoku**, **Kakuro**, **Calcudoku / KenKen**), **Crossword (`.puz`)** import, **Word Grid** tile pools, and **Public Domain Ink Tracing** plates. Runs either with the Python FastAPI + ReportLab PDF imposition backend or fully client-side in any modern browser.

---

## Option 1: Self-Host with Docker

Clone the repository and start the service on port `8080`:

```bash
docker compose up -d
```

Then open **http://localhost:8080** in your browser.

- Uploaded puzzles and library metadata are stored persistently in `./data` on your host (mapped to `/app/data` inside the container).
- To customize the port or data path, copy `.env.example` to `.env` and adjust `PORT` or `DATA_DIR`.

### Pull Prebuilt Container Image (GHCR)

Tagged releases automatically publish multi-architecture images (`linux/amd64` and `linux/arm64`) to GitHub Container Registry:

```bash
docker run -d \
  --name puzzle-book-generator \
  -p 8080:8080 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/<your-github-username>/<repo-name>:latest
```

---

## Option 2: Standalone Windows Executable (`.exe`)

No Python, Node.js, or Docker installation required:

1. Download **`PocketPuzzlePress.exe`** from the repository's **Releases** page on GitHub.
2. Place `PocketPuzzlePress.exe` in a folder where you want your puzzle uploads stored.
3. Double-click **`PocketPuzzlePress.exe`**.
   - A status console window opens and starts a local server on `http://127.0.0.1:8080` (automatically picking the next open port if `8080` is busy).
   - Your default browser opens automatically after 1 second.
4. Uploaded files are saved next to the executable in a `puzzle_data/` folder. Close the console window or press `Ctrl+C` when finished.

---

## Supported Puzzle Upload Formats

Open **Puzzle Library → Manage Files** to import custom content (with automatic SHA-256 duplicate protection):

| Format | Game Section | Notes |
| --- | --- | --- |
| **`.puz`** | Crossword | Standard Across Lite (`ACROSS&DOWN`) binary crossword files |
| **`.svg`** | Ink Tracing | Vector `<path d="...">` line drawings rendered in light tracing ink |
| **`.json`** | Crossword / Word Grid | Structured puzzle JSON (`{ title, width, height, solutionGrid, acrossClues, downClues }` or `{ words: [...] }`) |
| **`.txt`** | Word Grid | Plain-text word lists separated by spaces, commas, semicolons, or newlines (3–12 letters) |
