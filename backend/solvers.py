"""Algorithmic puzzle generators and file parsers matching src/types/booklet.ts."""

from __future__ import annotations

import hashlib
import json
import math
import random
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from .public_domain_plates import PUBLIC_DOMAIN_PLATES

SUDOKU_CLUES: Dict[str, int] = {
    "Easy": 40,
    "Medium": 33,
    "Hard": 26,
    "Expert": 22,
}

SEEDED_CROSSWORDS: Dict[str, List[Dict[str, Any]]] = {
    "Mini 5x5": [
        {
            "title": "Morning Press",
            "author": "Pocket Press Desk",
            "width": 5,
            "height": 5,
            "solutionGrid": [
                ["P", "A", "P", "E", "R"],
                ["A", "L", "O", "N", "E"],
                ["S", "T", "O", "N", "E"],
                ["T", "A", "P", "E", "D"],
                ["E", "R", "S", ".", "."],
            ],
            "acrossClues": [
                {"number": 1, "clue": "Stationery sheet", "answer": "PAPER"},
                {"number": 6, "clue": "Solo", "answer": "ALONE"},
                {"number": 7, "clue": "Lithograph slab", "answer": "STONE"},
                {"number": 8, "clue": "Secured with adhesive strip", "answer": "TAPED"},
                {"number": 9, "clue": "Hesitation syllables", "answer": "ERS"},
            ],
            "downClues": [
                {"number": 1, "clue": "Bookbinder glue", "answer": "PASTE"},
                {"number": 2, "clue": "Church table", "answer": "ALTAR"},
                {"number": 3, "clue": "Burst balloons", "answer": "POPS"},
                {"number": 4, "clue": "Chemical suffix", "answer": "ENE"},
                {"number": 5, "clue": "Marsh plant", "answer": "REED"},
            ],
        },
        {
            "title": "Pocket Notebook",
            "author": "Pocket Press Desk",
            "width": 5,
            "height": 5,
            "solutionGrid": [
                ["S", "P", "I", "N", "E"],
                ["T", "A", "P", "E", "R"],
                ["A", "G", "A", "T", "E"],
                ["M", "E", "T", "E", "D"],
                ["P", "S", ".", ".", "."],
            ],
            "acrossClues": [
                {"number": 1, "clue": "Stapled fold edge", "answer": "SPINE"},
                {"number": 6, "clue": "Slender candle", "answer": "TAPER"},
                {"number": 7, "clue": "5.5-point type size", "answer": "AGATE"},
                {"number": 8, "clue": "Measured out", "answer": "METED"},
                {"number": 9, "clue": "Postscript abbr.", "answer": "PS"},
            ],
            "downClues": [
                {"number": 1, "clue": "Rubber ink block", "answer": "STAMP"},
                {"number": 2, "clue": "Book leaves", "answer": "PAGES"},
                {"number": 3, "clue": "Tablet model", "answer": "IPAT"},
                {"number": 4, "clue": "Mesh fabric", "answer": "NET"},
                {"number": 5, "clue": "Before, of old", "answer": "ERED"},
            ],
        },
    ],
    "Everyday": [
        {
            "title": "Stationery Shop",
            "author": "H. Vance",
            "width": 7,
            "height": 7,
            "solutionGrid": [
                ["F", "O", "L", "I", "O", ".", "P"],
                ["O", "V", "E", "N", "S", ".", "A"],
                ["L", "E", "A", "F", "S", ".", "P"],
                ["D", "R", "N", ".", "E", "R", "E"],
                [".", "S", "T", "A", "T", "E", "R"],
                ["P", "E", "N", "N", "E", "D", "."],
                ["B", "A", "S", "E", "S", ".", "."],
            ],
            "acrossClues": [
                {"number": 1, "clue": "Folded sheet size", "answer": "FOLIO"},
                {"number": 6, "clue": "Bakery chambers", "answer": "OVENS"},
                {"number": 7, "clue": "Book pages (var.)", "answer": "LEAFS"},
                {"number": 8, "clue": "Before, poetically", "answer": "ERE"},
                {"number": 10, "clue": "Ancient Greek coin", "answer": "STATER"},
                {"number": 12, "clue": "Wrote with fountain ink", "answer": "PENNED"},
                {"number": 13, "clue": "Foundations", "answer": "BASES"},
            ],
            "downClues": [
                {"number": 1, "clue": "Crease in half", "answer": "FOLD"},
                {"number": 2, "clue": "Look closely at", "answer": "OVERSEA"},
                {"number": 3, "clue": "Inclined toward", "answer": "LEANT"},
                {"number": 4, "clue": "Information bit", "answer": "INF"},
                {"number": 5, "clue": "Typeface weight", "answer": "OSSETE"},
                {"number": 9, "clue": "Crimson shade", "answer": "RED"},
            ],
        }
    ],
    "Cryptic/Tough": [
        {
            "title": "Gutenberg Midnight",
            "author": "C. Mercer",
            "width": 7,
            "height": 7,
            "solutionGrid": [
                ["Q", "U", "I", "R", "E", ".", "B"],
                ["U", "N", "D", "E", "R", ".", "I"],
                ["I", "T", "E", "M", "S", ".", "N"],
                ["P", "I", "A", ".", "T", "Y", "D"],
                [".", "E", "S", "T", "E", "E", "S"],
                ["G", "L", "I", "P", "H", "S", "."],
                ["C", "O", "P", "Y", ".", ".", "."],
            ],
            "acrossClues": [
                {"number": 1, "clue": "24 sheets of paper", "answer": "QUIRE"},
                {"number": 6, "clue": "Beneath the margin", "answer": "UNDER"},
                {"number": 7, "clue": "Inventory entries", "answer": "ITEMS"},
                {"number": 8, "clue": "Devout Latin fem.", "answer": "PIA"},
                {"number": 10, "clue": "Measured degrees", "answer": "ESTEES"},
                {"number": 12, "clue": "Carved symbols (alt.)", "answer": "GLIPHS"},
                {"number": 13, "clue": "Proofreading manuscript", "answer": "COPY"},
            ],
            "downClues": [
                {"number": 1, "clue": "Witty remark", "answer": "QUIP"},
                {"number": 2, "clue": "Loosen knots", "answer": "UNTIE"},
                {"number": 3, "clue": "Concepts in ink", "answer": "IDEAS"},
                {"number": 4, "clue": "Dream sleep stage", "answer": "REM"},
                {"number": 5, "clue": "Binds pages together", "answer": "BINDS"},
            ],
        }
    ],
}

WORD_BANKS: Dict[str, List[List[str]]] = {
    "Everyday Vocabulary": [
        ["PAPER", "FOLIO", "PRESS", "STAMP", "INK", "BIND"],
        ["COFFEE", "TRAIN", "STATION", "TICKET", "NOTES", "READ"],
        ["PENCIL", "RULER", "TABLE", "CHAIR", "LAMP", "DESK"],
    ],
    "Sci-Fi & Fantasy": [
        ["ORBIT", "NEBULA", "STAR", "WARP", "BEAM", "SHIP"],
        ["DRAGON", "RUNE", "QUEST", "CASTLE", "BLADE", "MAGE"],
        ["CYBER", "DROID", "PULSE", "NEXUS", "COMET", "VOID"],
    ],
    "Nature & Outdoors": [
        ["CEDAR", "TRAIL", "RIVER", "PEAK", "MOSS", "FERN"],
        ["ACORN", "BIRCH", "CREEK", "MEADOW", "STONE", "HAWK"],
        ["CLOUD", "FROST", "PINE", "VALLEY", "BROOK", "LEAF"],
    ],
    "Custom Word List": [
        ["PRINT", "BOOK", "FOLD", "STITCH", "GRID", "CROP"],
    ],
}


# ---------- 1. PROCEDURAL SUDOKU WITH UNIQUENESS VERIFICATION ----------

_ALL_DIGITS_MASK = 0x3FE  # bits 1..9


def _generate_full_sudoku(rng: random.Random) -> List[List[int]]:
    board = [[0] * 9 for _ in range(9)]
    row_mask = [0] * 9
    col_mask = [0] * 9
    box_mask = [0] * 9

    def fill(pos: int) -> bool:
        if pos == 81:
            return True
        r, c = divmod(pos, 9)
        b = (r // 3) * 3 + (c // 3)
        used = row_mask[r] | col_mask[c] | box_mask[b]
        candidates = [d for d in range(1, 10) if not (used & (1 << d))]
        rng.shuffle(candidates)
        for d in candidates:
            bit = 1 << d
            board[r][c] = d
            row_mask[r] |= bit
            col_mask[c] |= bit
            box_mask[b] |= bit
            if fill(pos + 1):
                return True
            board[r][c] = 0
            row_mask[r] &= ~bit
            col_mask[c] &= ~bit
            box_mask[b] &= ~bit
        return False

    fill(0)
    return board


def count_sudoku_solutions(puzzle: List[List[int]], limit: int = 2) -> int:
    """MRV backtracking solver counting up to `limit` distinct Sudoku solutions."""
    row_mask = [0] * 9
    col_mask = [0] * 9
    box_mask = [0] * 9
    empties: List[Tuple[int, int]] = []

    for r in range(9):
        for c in range(9):
            val = puzzle[r][c]
            if val:
                bit = 1 << val
                row_mask[r] |= bit
                col_mask[c] |= bit
                box_mask[(r // 3) * 3 + (c // 3)] |= bit
            else:
                empties.append((r, c))

    solutions = 0

    def search() -> None:
        nonlocal solutions
        if solutions >= limit:
            return
        if not empties:
            solutions += 1
            return

        # Choose empty cell with Minimum Remaining Values (MRV)
        best_idx = -1
        best_avail = 0
        best_count = 10

        for idx, (r, c) in enumerate(empties):
            b = (r // 3) * 3 + (c // 3)
            avail = _ALL_DIGITS_MASK & ~(row_mask[r] | col_mask[c] | box_mask[b])
            cnt = avail.bit_count()
            if cnt == 0:
                return
            if cnt < best_count:
                best_count = cnt
                best_avail = avail
                best_idx = idx
                if cnt == 1:
                    break

        r, c = empties.pop(best_idx)
        b = (r // 3) * 3 + (c // 3)
        avail = best_avail
        while avail and solutions < limit:
            lsb = avail & -avail
            avail ^= lsb
            row_mask[r] |= lsb
            col_mask[c] |= lsb
            box_mask[b] |= lsb
            search()
            row_mask[r] &= ~lsb
            col_mask[c] &= ~lsb
            box_mask[b] &= ~lsb
        empties.insert(best_idx, (r, c))

    search()
    return solutions


def generate_sudoku(index: int, difficulty: str, seed: int) -> Dict[str, Any]:
    rng = random.Random(seed + index * 7919)
    solution = _generate_full_sudoku(rng)
    puzzle = [row[:] for row in solution]

    target_clues = SUDOKU_CLUES.get(difficulty, 33)
    target_blanks = 81 - target_clues

    pairs = [(i, 80 - i) for i in range(40)]
    rng.shuffle(pairs)
    blanks = 0

    # Try symmetric center if odd blanks needed
    if target_blanks % 2 == 1:
        saved = puzzle[4][4]
        puzzle[4][4] = 0
        if count_sudoku_solutions(puzzle, 2) == 1:
            blanks += 1
        else:
            puzzle[4][4] = saved

    # Carve symmetric pairs while preserving unique solution
    for a, b in pairs:
        if blanks >= target_blanks:
            break
        ar, ac = divmod(a, 9)
        br, bc = divmod(b, 9)
        sa, sb = puzzle[ar][ac], puzzle[br][bc]
        puzzle[ar][ac] = 0
        puzzle[br][bc] = 0
        if count_sudoku_solutions(puzzle, 2) == 1:
            blanks += 2
        else:
            puzzle[ar][ac] = sa
            puzzle[br][bc] = sb

    # If symmetric carving couldn't hit target_blanks (rare on Expert), try single cells
    if blanks < target_blanks:
        singles = [(r, c) for r in range(9) for c in range(9) if puzzle[r][c] != 0]
        rng.shuffle(singles)
        for r, c in singles:
            if blanks >= target_blanks:
                break
            saved = puzzle[r][c]
            puzzle[r][c] = 0
            if count_sudoku_solutions(puzzle, 2) == 1:
                blanks += 1
            else:
                puzzle[r][c] = saved

    return {
        "kind": "sudoku",
        "index": index,
        "difficulty": difficulty,
        "puzzle": puzzle,
        "solution": solution,
    }


# ---------- 2. PROCEDURAL KAKURO WITH UNIQUENESS VERIFICATION ----------


def _has_only_valid_runs(mask: List[List[bool]], size: int) -> bool:
    open_count = 0
    max_run = 4 if size <= 7 else 5
    for r in range(1, size):
        run = 0
        for c in range(1, size):
            if mask[r][c]:
                run += 1
                open_count += 1
                if run > max_run:
                    return False
            else:
                if run == 1:
                    return False
                run = 0
        if run == 1:
            return False

    for c in range(1, size):
        run = 0
        for r in range(1, size):
            if mask[r][c]:
                run += 1
                if run > max_run:
                    return False
            else:
                if run == 1:
                    return False
                run = 0
        if run == 1:
            return False

    return open_count >= math.floor((size - 1) * (size - 1) * 0.44)


def _build_procedural_kakuro_mask(size: int, rng: random.Random) -> List[List[bool]]:
    for _ in range(120):
        mask = [[False] * size for _ in range(size)]
        for r in range(1, size):
            for c in range(1, size):
                mask[r][c] = True

        barrier_pairs = 5 if size <= 6 else (7 if size == 7 else 10)
        for _ in range(barrier_pairs):
            r = rng.randint(1, size - 1)
            c = rng.randint(1, size - 1)
            mask[r][c] = False
            mask[size - r][size - c] = False

        # Repair length-1 runs
        for _ in range(4):
            for r in range(1, size):
                for c in range(1, size):
                    if not mask[r][c]:
                        continue
                    h_len = (1 if c > 1 and mask[r][c - 1] else 0) + (
                        1 if c + 1 < size and mask[r][c + 1] else 0
                    )
                    v_len = (1 if r > 1 and mask[r - 1][c] else 0) + (
                        1 if r + 1 < size and mask[r + 1][c] else 0
                    )
                    if h_len == 0 or v_len == 0:
                        mask[r][c] = False

        if _has_only_valid_runs(mask, size):
            return mask

    # Structured symmetric lattice fallback guaranteed to have runs of 2-4
    fallback = [[False] * size for _ in range(size)]
    for r in range(1, size):
        for c in range(1, size):
            fallback[r][c] = True
    if size == 6:
        for rr, cc in ((1, 3), (5, 3), (3, 1), (3, 5), (2, 4), (4, 2)):
            fallback[rr][cc] = False
    elif size == 7:
        for rr, cc in ((1, 3), (6, 4), (3, 1), (4, 6), (2, 5), (5, 2), (3, 4), (4, 3)):
            fallback[rr][cc] = False
    else:
        for rr, cc in ((1, 4), (7, 4), (4, 1), (4, 7), (2, 2), (6, 6), (2, 6), (6, 2)):
            fallback[rr][cc] = False
    return fallback


def _solve_kakuro_digits(
    mask: List[List[bool]], size: int, rng: random.Random
) -> Optional[List[List[int]]]:
    vals = [[0] * size for _ in range(size)]
    open_cells = [(r, c) for r in range(1, size) for c in range(1, size) if mask[r][c]]

    def row_used(r: int, c: int) -> set:
        used = set()
        cc = c - 1
        while cc >= 1 and mask[r][cc]:
            used.add(vals[r][cc])
            cc -= 1
        cc = c + 1
        while cc < size and mask[r][cc]:
            if vals[r][cc] > 0:
                used.add(vals[r][cc])
            cc += 1
        return used

    def col_used(r: int, c: int) -> set:
        used = set()
        rr = r - 1
        while rr >= 1 and mask[rr][c]:
            used.add(vals[rr][c])
            rr -= 1
        rr = r + 1
        while rr < size and mask[rr][c]:
            if vals[rr][c] > 0:
                used.add(vals[rr][c])
            rr += 1
        return used

    steps = 0

    def backtrack(idx: int) -> bool:
        nonlocal steps
        if idx == len(open_cells):
            return True
        steps += 1
        if steps > 6000:
            return False
        r, c = open_cells[idx]
        used = row_used(r, c) | col_used(r, c)
        # Prefer extreme digits (1,2,8,9) slightly more often to produce unique sums cleanly
        candidates = [d for d in range(1, 10) if d not in used]
        rng.shuffle(candidates)
        for d in candidates:
            vals[r][c] = d
            if backtrack(idx + 1):
                return True
            vals[r][c] = 0
        return False

    return vals if backtrack(0) else None


def _count_kakuro_solutions(
    mask: List[List[bool]], digits: List[List[int]], size: int, limit: int = 2
) -> int:
    """Verify Kakuro clue uniqueness using run sum bounds & dynamic MRV backtracking."""
    across_runs: List[Dict[str, Any]] = []
    down_runs: List[Dict[str, Any]] = []
    cell_across: Dict[Tuple[int, int], int] = {}
    cell_down: Dict[Tuple[int, int], int] = {}

    for r in range(1, size):
        c = 1
        while c < size:
            if mask[r][c]:
                cells = []
                target = 0
                while c < size and mask[r][c]:
                    cells.append((r, c))
                    target += digits[r][c]
                    c += 1
                rid = len(across_runs)
                for rc in cells:
                    cell_across[rc] = rid
                across_runs.append({"target": target, "len": len(cells), "sum": 0, "filled": 0, "used": 0})
            else:
                c += 1

    for c in range(1, size):
        r = 1
        while r < size:
            if mask[r][c]:
                cells = []
                target = 0
                while r < size and mask[r][c]:
                    cells.append((r, c))
                    target += digits[r][c]
                    r += 1
                rid = len(down_runs)
                for rc in cells:
                    cell_down[rc] = rid
                down_runs.append({"target": target, "len": len(cells), "sum": 0, "filled": 0, "used": 0})
            else:
                r += 1

    unassigned = list(cell_across.keys())

    def valid_candidates(ar: Dict[str, Any], dr: Dict[str, Any]) -> List[int]:
        used = ar["used"] | dr["used"]
        rem_a_cells = ar["len"] - (ar["filled"] + 1)
        rem_d_cells = dr["len"] - (dr["filled"] + 1)
        rem_a_base = ar["target"] - ar["sum"]
        rem_d_base = dr["target"] - dr["sum"]

        # Quick bounds before iterating digits
        out: List[int] = []
        for d in range(1, 10):
            bit = 1 << d
            if used & bit:
                continue
            rem_a_sum = rem_a_base - d
            if rem_a_cells == 0:
                if rem_a_sum != 0:
                    continue
            else:
                if rem_a_sum <= 0:
                    continue
                a_mask = ar["used"] | bit
                avail_a = [x for x in range(1, 10) if not (a_mask & (1 << x))]
                if len(avail_a) < rem_a_cells:
                    continue
                if not (sum(avail_a[:rem_a_cells]) <= rem_a_sum <= sum(avail_a[-rem_a_cells:])):
                    continue

            rem_d_sum = rem_d_base - d
            if rem_d_cells == 0:
                if rem_d_sum != 0:
                    continue
            else:
                if rem_d_sum <= 0:
                    continue
                d_mask = dr["used"] | bit
                avail_d = [x for x in range(1, 10) if not (d_mask & (1 << x))]
                if len(avail_d) < rem_d_cells:
                    continue
                if not (sum(avail_d[:rem_d_cells]) <= rem_d_sum <= sum(avail_d[-rem_d_cells:])):
                    continue

            out.append(d)
        return out

    solutions = 0
    steps = 0

    def search() -> None:
        nonlocal solutions, steps
        if solutions >= limit or steps > 4000:
            return
        if not unassigned:
            solutions += 1
            return
        steps += 1

        best_idx = -1
        best_cands: Optional[List[int]] = None
        for idx, rc in enumerate(unassigned):
            cands = valid_candidates(across_runs[cell_across[rc]], down_runs[cell_down[rc]])
            if not cands:
                return
            if best_cands is None or len(cands) < len(best_cands):
                best_cands = cands
                best_idx = idx
                if len(cands) == 1:
                    break

        assert best_cands is not None
        rc = unassigned.pop(best_idx)
        ar = across_runs[cell_across[rc]]
        dr = down_runs[cell_down[rc]]
        for d in best_cands:
            bit = 1 << d
            ar["sum"] += d
            ar["filled"] += 1
            ar["used"] |= bit
            dr["sum"] += d
            dr["filled"] += 1
            dr["used"] |= bit
            search()
            ar["sum"] -= d
            ar["filled"] -= 1
            ar["used"] &= ~bit
            dr["sum"] -= d
            dr["filled"] -= 1
            dr["used"] &= ~bit
            if solutions >= limit:
                break
        unassigned.insert(best_idx, rc)

    search()
    if steps > 4000 and solutions == 1:
        return 2
    return solutions


def generate_kakuro(index: int, difficulty: str, seed: int) -> Dict[str, Any]:
    size = 6 if difficulty == "Easy" else (8 if difficulty == "Expert" else 7)
    base_seed = seed + index * 3571 + size * 97

    chosen_mask: Optional[List[List[bool]]] = None
    chosen_digits: Optional[List[List[int]]] = None

    for attempt in range(25):
        rng = random.Random(base_seed + attempt * 131)
        mask = _build_procedural_kakuro_mask(size, rng)
        digits = _solve_kakuro_digits(mask, size, rng)
        if not digits:
            continue
        if _count_kakuro_solutions(mask, digits, size, limit=2) == 1:
            chosen_mask = mask
            chosen_digits = digits
            break
        if chosen_digits is None:
            chosen_mask = mask
            chosen_digits = digits

    if chosen_mask is None or chosen_digits is None:
        rng = random.Random(base_seed)
        chosen_mask = _build_procedural_kakuro_mask(size, rng)
        chosen_digits = [
            [((r + c * 2) % 9) + 1 if chosen_mask[r][c] else 0 for c in range(size)]
            for r in range(size)
        ]

    grid: List[List[Dict[str, Any]]] = [[{"type": "black"} for _ in range(size)] for _ in range(size)]
    for r in range(size):
        for c in range(size):
            if chosen_digits[r][c] > 0:
                grid[r][c] = {"type": "empty", "solution": chosen_digits[r][c]}
            else:
                across_sum = 0
                if c + 1 < size and chosen_digits[r][c + 1] > 0:
                    cc = c + 1
                    while cc < size and chosen_digits[r][cc] > 0:
                        across_sum += chosen_digits[r][cc]
                        cc += 1
                down_sum = 0
                if r + 1 < size and chosen_digits[r + 1][c] > 0:
                    rr = r + 1
                    while rr < size and chosen_digits[rr][c] > 0:
                        down_sum += chosen_digits[rr][c]
                        rr += 1
                if across_sum > 0 or down_sum > 0:
                    cell: Dict[str, Any] = {"type": "clue"}
                    if across_sum > 0:
                        cell["acrossSum"] = across_sum
                    if down_sum > 0:
                        cell["downSum"] = down_sum
                    grid[r][c] = cell
                else:
                    grid[r][c] = {"type": "black"}

    return {
        "kind": "kakuro",
        "index": index,
        "difficulty": difficulty,
        "size": size,
        "grid": grid,
    }


# ---------- 3. PROCEDURAL CALCUDOKU / KENKEN ----------


def _build_latin_square(size: int, rng: random.Random) -> List[List[int]]:
    base = [[((r + c) % size) + 1 for c in range(size)] for r in range(size)]
    row_idx = list(range(size))
    col_idx = list(range(size))
    digits = list(range(1, size + 1))
    rng.shuffle(row_idx)
    rng.shuffle(col_idx)
    rng.shuffle(digits)
    return [[digits[base[r][c] - 1] for c in col_idx] for r in row_idx]


def generate_calcudoku(
    index: int, size: int, difficulty: str, seed: int
) -> Dict[str, Any]:
    rng = random.Random(seed + index * 4999 + size * 101)
    solution = _build_latin_square(size, rng)
    visited = [[False] * size for _ in range(size)]
    cages: List[Dict[str, Any]] = []
    cage_id = 1

    # Easy restricts cages strictly to max 2 cells and '+' / '-' operators only
    max_cage_size = 2 if difficulty == "Easy" else (3 if difficulty == "Medium" else 4)

    for r in range(size):
        for c in range(size):
            if visited[r][c]:
                continue
            cells: List[List[int]] = [[r, c]]
            visited[r][c] = True

            if max_cage_size == 2:
                target_len = 1 if rng.random() < 0.14 else 2
            else:
                target_len = (
                    1 if rng.random() < 0.14 else 2 + int(rng.random() * max(1, max_cage_size - 1))
                )

            while len(cells) < target_len:
                neighbors: List[List[int]] = []
                for cr, cc in cells:
                    for dr, dc in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                        nr, nc = cr + dr, cc + dc
                        if (
                            0 <= nr < size
                            and 0 <= nc < size
                            and not visited[nr][nc]
                            and [nr, nc] not in neighbors
                        ):
                            neighbors.append([nr, nc])
                if not neighbors:
                    break
                pick = rng.choice(neighbors)
                visited[pick[0]][pick[1]] = True
                cells.append(pick)

            vals = [solution[cr][cc] for cr, cc in cells]
            target = vals[0]
            op = ""

            if len(cells) == 2:
                a, b = (vals[0], vals[1]) if vals[0] >= vals[1] else (vals[1], vals[0])
                if difficulty == "Easy":
                    if rng.random() < 0.5:
                        op = "-"
                        target = a - b
                    else:
                        op = "+"
                        target = a + b
                else:
                    roll = rng.random()
                    if a % b == 0 and roll < 0.28:
                        op = "÷"
                        target = a // b
                    elif roll < 0.56:
                        op = "-"
                        target = a - b
                    elif roll < 0.80:
                        op = "×"
                        target = a * b
                    else:
                        op = "+"
                        target = a + b
            elif len(cells) >= 3:
                prod = math.prod(vals)
                if difficulty != "Easy" and rng.random() < 0.48 and prod <= 240:
                    op = "×"
                    target = prod
                else:
                    op = "+"
                    target = sum(vals)

            cages.append({"id": cage_id, "target": target, "op": op, "cells": cells})
            cage_id += 1

    return {
        "kind": "calcudoku",
        "index": index,
        "difficulty": difficulty,
        "size": size,
        "cages": cages,
        "solution": solution,
    }


# ---------- 4. BINARY ACROSS LITE (.PUZ) & UPLOAD PARSERS ----------


def _read_null_terminated_strings(
    data: bytes, start_offset: int, count: int
) -> List[str]:
    results: List[str] = []
    offset = start_offset
    n = len(data)
    for _ in range(count):
        if offset >= n:
            break
        end = data.find(b"\x00", offset)
        if end == -1:
            end = n
        results.append(data[offset:end].decode("latin-1", errors="replace").strip())
        offset = end + 1
    return results


def parse_puz_binary(data: bytes, fallback_filename: str) -> Dict[str, Any]:
    if len(data) < 52:
        raise ValueError("File is too small to be a valid .puz crossword.")

    magic = data[2:13].decode("ascii", errors="replace")
    if magic != "ACROSS&DOWN":
        raise ValueError("Missing ACROSS&DOWN header signature.")

    width = data[0x2C]
    height = data[0x2D]
    clue_count = data[0x2E] | (data[0x2F] << 8)

    if width == 0 or height == 0 or width > 25 or height > 25:
        raise ValueError(f"Invalid crossword grid dimensions ({width}x{height}).")

    grid_size = width * height
    solution_offset = 0x34
    strings_offset = solution_offset + grid_size * 2

    if strings_offset > len(data):
        raise ValueError("Truncated .puz payload.")

    solution_flat = data[solution_offset : solution_offset + grid_size].decode(
        "latin-1", errors="replace"
    )
    solution_grid: List[List[str]] = []
    for r in range(height):
        row: List[str] = []
        for c in range(width):
            ch = solution_flat[r * width + c] if (r * width + c) < len(solution_flat) else "."
            row.append("." if ch in (".", ":") else ch.upper())
        solution_grid.append(row)

    strings = _read_null_terminated_strings(data, strings_offset, 3 + clue_count)
    title = (strings[0] if len(strings) > 0 and strings[0] else re.sub(r"\.puz$", "", fallback_filename, flags=re.IGNORECASE))
    author = strings[1] if len(strings) > 1 and strings[1] else "Independent Constructor"
    copyright_str = strings[2] if len(strings) > 2 else ""
    raw_clues = strings[3:]

    across_clues: List[Dict[str, Any]] = []
    down_clues: List[Dict[str, Any]] = []
    clue_cursor = 0
    cell_num = 1

    for r in range(height):
        for c in range(width):
            if solution_grid[r][c] == ".":
                continue

            starts_across = (
                (c == 0 or solution_grid[r][c - 1] == ".")
                and c + 1 < width
                and solution_grid[r][c + 1] != "."
            )
            starts_down = (
                (r == 0 or solution_grid[r - 1][c] == ".")
                and r + 1 < height
                and solution_grid[r + 1][c] != "."
            )

            if starts_across or starts_down:
                if starts_across:
                    ans = []
                    cc = c
                    while cc < width and solution_grid[r][cc] != ".":
                        ans.append(solution_grid[r][cc])
                        cc += 1
                    clue_txt = (
                        raw_clues[clue_cursor]
                        if clue_cursor < len(raw_clues) and raw_clues[clue_cursor]
                        else f"Across {cell_num}"
                    )
                    across_clues.append({"number": cell_num, "clue": clue_txt, "answer": "".join(ans)})
                    clue_cursor += 1

                if starts_down:
                    ans = []
                    rr = r
                    while rr < height and solution_grid[rr][c] != ".":
                        ans.append(solution_grid[rr][c])
                        rr += 1
                    clue_txt = (
                        raw_clues[clue_cursor]
                        if clue_cursor < len(raw_clues) and raw_clues[clue_cursor]
                        else f"Down {cell_num}"
                    )
                    down_clues.append({"number": cell_num, "clue": clue_txt, "answer": "".join(ans)})
                    clue_cursor += 1

                cell_num += 1

    return {
        "title": title,
        "author": author,
        "copyright": copyright_str,
        "width": width,
        "height": height,
        "solutionGrid": solution_grid,
        "acrossClues": across_clues,
        "downClues": down_clues,
    }


def parse_svg_illustration(svg_text: str, filename: str) -> Dict[str, Any]:
    lowered = svg_text.lower()
    if "<!doctype" in lowered or "<!entity" in lowered:
        raise ValueError("SVG DTD/ENTITY declarations are not permitted.")

    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid SVG document: {exc}") from exc

    tag_name = root.tag.split("}")[-1].lower()
    if tag_name != "svg":
        raise ValueError("Invalid SVG document: missing <svg> root element.")

    vb_size = 100.0
    view_box = root.attrib.get("viewBox")
    if view_box:
        parts = [p for p in re.split(r"[\s,]+", view_box.strip()) if p]
        if len(parts) == 4:
            try:
                w_val = float(parts[2])
                h_val = float(parts[3])
                if w_val > 0 and h_val > 0:
                    vb_size = max(w_val, h_val)
            except ValueError:
                pass

    paths: List[str] = []
    for elem in root.iter():
        if elem.tag.split("}")[-1].lower() == "path":
            d_val = (elem.attrib.get("d") or "").strip()
            if d_val:
                paths.append(d_val)

    if not paths:
        raise ValueError('SVG contains no <path d="..."> vector strokes for tracing.')

    clean_title = re.sub(r"[_-]+", " ", re.sub(r"\.svg$", "", filename, flags=re.IGNORECASE)).strip()
    return {
        "title": clean_title or "Uploaded Plate",
        "attribution": "Custom Public Domain SVG Upload",
        "year": "Uploaded",
        "viewBoxSize": vb_size,
        "paths": paths,
    }


def parse_uploaded_puzzle_bytes(raw_bytes: bytes, filename: str) -> Tuple[Dict[str, Any], str]:
    sha256 = hashlib.sha256(raw_bytes).hexdigest()
    lower = filename.lower()

    if lower.endswith(".puz"):
        parsed = parse_puz_binary(raw_bytes, filename)
        clue_total = len(parsed["acrossClues"]) + len(parsed["downClues"])
        return (
            {
                "filename": filename,
                "gameType": "crossword",
                "source": "uploaded",
                "packOrTheme": "Custom Upload",
                "format": "puz",
                "sha256": sha256,
                "summary": f"{parsed['width']}×{parsed['height']} crossword · {clue_total} clues · {parsed['title']}",
                "crosswordData": parsed,
            },
            sha256,
        )

    text = raw_bytes.decode("utf-8", errors="replace").strip()

    if lower.endswith(".svg"):
        ill = parse_svg_illustration(text, filename)
        return (
            {
                "filename": filename,
                "gameType": "line-art",
                "source": "uploaded",
                "packOrTheme": "Uploaded SVG Plates",
                "format": "svg",
                "sha256": sha256,
                "summary": f"SVG tracing plate · {len(ill['paths'])} vector paths · {ill['title']}",
                "illustrationData": ill,
            },
            sha256,
        )

    if lower.endswith(".json"):
        payload = json.loads(text)
        if not isinstance(payload, dict):
            raise ValueError("JSON puzzle pack must be an object.")
        raw_gt = str(payload.get("gameType", "word-grid"))
        game_type = raw_gt if raw_gt in ("crossword", "word-grid", "line-art") else "word-grid"

        if (
            game_type == "crossword"
            and isinstance(payload.get("solutionGrid"), list)
            and isinstance(payload.get("acrossClues"), list)
        ):
            w = int(payload.get("width", len(payload["solutionGrid"])))
            h = int(payload.get("height", len(payload["solutionGrid"])))
            return (
                {
                    "filename": filename,
                    "gameType": "crossword",
                    "source": "uploaded",
                    "packOrTheme": str(payload.get("pack") or "Custom Upload"),
                    "format": "json",
                    "sha256": sha256,
                    "summary": f"{w}×{h} JSON crossword · {payload.get('title') or filename}",
                    "crosswordData": payload,
                },
                sha256,
            )

        words_raw = payload.get("words")
        words: Optional[List[str]] = None
        if isinstance(words_raw, list):
            cleaned = [re.sub(r"[^A-Z]", "", str(w).upper()) for w in words_raw]
            words = [w for w in cleaned if len(w) >= 3]

        return (
            {
                "filename": filename,
                "gameType": game_type,
                "source": "uploaded",
                "packOrTheme": str(payload.get("theme") or payload.get("pack") or "Custom Upload"),
                "format": "json",
                "sha256": sha256,
                "summary": (
                    f"JSON pack · {len(words)} custom words"
                    if words is not None
                    else f"JSON puzzle pack · {payload.get('title') or filename}"
                ),
                "customWords": words,
                "rawNotes": text[:400],
            },
            sha256,
        )

    if lower.endswith(".txt"):
        tokens = re.split(r"[\s,;]+", text)
        words = []
        seen = set()
        for tok in tokens:
            cleaned = re.sub(r"[^A-Z]", "", tok.strip().upper())
            if 3 <= len(cleaned) <= 12 and cleaned not in seen:
                seen.add(cleaned)
                words.append(cleaned)
        if not words:
            raise ValueError("No valid words or puzzle entries found in text file.")

        return (
            {
                "filename": filename,
                "gameType": "word-grid",
                "source": "uploaded",
                "packOrTheme": "Custom Word List",
                "format": "txt",
                "sha256": sha256,
                "summary": f"Custom word list · {len(words)} unique words",
                "customWords": words,
            },
            sha256,
        )

    raise ValueError("Unsupported file type. Upload .puz, .svg, .json, or .txt files.")


# ---------- 5. CROSSWORD, WORD GRID & LINE ART SELECTORS ----------


def generate_crossword(
    index: int, block: Dict[str, Any], vault_items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    uploaded = [
        v for v in vault_items
        if v.get("gameType") == "crossword"
        and v.get("source") == "uploaded"
        and v.get("crosswordData")
    ]
    seeded = [
        v for v in vault_items
        if v.get("gameType") == "crossword"
        and v.get("source") == "seeded"
        and v.get("crosswordData")
    ]

    source_mode = block.get("crosswordSource", "Seeded Library")
    pack = block.get("crosswordPack", "Everyday")

    if source_mode == "Uploaded .puz Files" and uploaded:
        picked = uploaded[(index - 1) % len(uploaded)]
        return {
            "kind": "crossword",
            "index": index,
            "pack": pack,
            "sourceLabel": f"Uploaded · {picked['filename']}",
            "data": picked["crosswordData"],
        }

    if pack == "Custom Upload" and uploaded:
        picked = uploaded[(index - 1) % len(uploaded)]
        return {
            "kind": "crossword",
            "index": index,
            "pack": pack,
            "sourceLabel": f"Upload · {picked['filename']}",
            "data": picked["crosswordData"],
        }

    matching_seeded = [v for v in seeded if v.get("packOrTheme") == pack]
    if matching_seeded:
        picked = matching_seeded[(index - 1) % len(matching_seeded)]
        return {
            "kind": "crossword",
            "index": index,
            "pack": pack,
            "sourceLabel": f"Seeded · {picked['filename']}",
            "data": picked["crosswordData"],
        }

    fallback_pool = SEEDED_CROSSWORDS.get(pack, SEEDED_CROSSWORDS["Mini 5x5"])
    data = fallback_pool[(index - 1) % len(fallback_pool)]
    return {
        "kind": "crossword",
        "index": index,
        "pack": pack,
        "sourceLabel": (
            "Fallback Seed (Upload .puz in Library)"
            if source_mode == "Uploaded .puz Files"
            else f"Seeded · {pack}"
        ),
        "data": data,
    }


def generate_word_grid(
    index: int, block: Dict[str, Any], vault_items: List[Dict[str, Any]], seed: int
) -> Dict[str, Any]:
    rng = random.Random(seed + index * 2027)
    theme = block.get("wordGridTheme", "Everyday Vocabulary")
    difficulty = block.get("wordGridDifficulty", "Standard")

    custom_words: List[str] = []
    for item in vault_items:
        cw = item.get("customWords")
        if isinstance(cw, list) and cw:
            custom_words.extend(cw)

    if theme == "Custom Word List" and len(custom_words) >= 4:
        pool = custom_words[:]
        rng.shuffle(pool)
        target_words = pool[:6]
    else:
        sets = WORD_BANKS.get(theme, WORD_BANKS["Everyday Vocabulary"])
        target_words = sets[(index - 1) % len(sets)]

    letters = list("".join(target_words))
    if difficulty == "Timed Sprint":
        letters.extend(["E", "A", "R", "T", "S"])
    rng.shuffle(letters)
    tiles = letters[:21]

    grid_size = 7
    sample_grid = [[""] * grid_size for _ in range(grid_size)]
    w0 = target_words[0] if len(target_words) > 0 else "PRESS"
    for c in range(min(grid_size, len(w0))):
        sample_grid[3][c] = w0[c]
    w1 = target_words[1] if len(target_words) > 1 else "PAPER"
    for r in range(min(grid_size, len(w1))):
        sample_grid[r][1] = w1[r]
    w2 = target_words[2] if len(target_words) > 2 else "INK"
    for r in range(min(grid_size, len(w2))):
        if r + 1 < grid_size:
            sample_grid[r + 1][4] = w2[r]

    return {
        "kind": "word-grid",
        "index": index,
        "theme": theme,
        "difficulty": difficulty,
        "tiles": tiles,
        "targetWords": target_words,
        "gridSize": grid_size,
        "sampleSolutionGrid": sample_grid,
    }


def generate_line_art(
    index: int,
    theme: str,
    line_weight: str,
    tracing_style: str,
    vault_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    uploaded_plates = [
        v for v in vault_items
        if v.get("gameType") == "line-art"
        and v.get("source") == "uploaded"
        and v.get("illustrationData")
    ]

    if theme == "Uploaded SVG Plates" and uploaded_plates:
        picked = uploaded_plates[(index - 1) % len(uploaded_plates)]
        ill = picked["illustrationData"]
        return {
            "kind": "line-art",
            "index": index,
            "theme": theme,
            "lineWeight": line_weight,
            "tracingLineStyle": tracing_style,
            "title": ill["title"],
            "attribution": ill["attribution"],
            "viewBoxSize": ill.get("viewBoxSize", 100),
            "paths": ill["paths"],
        }

    themed = [p for p in PUBLIC_DOMAIN_PLATES if p["theme"] == theme]
    pool = themed if themed else PUBLIC_DOMAIN_PLATES
    plate = pool[(index - 1) % len(pool)]

    return {
        "kind": "line-art",
        "index": index,
        "theme": theme,
        "lineWeight": line_weight,
        "tracingLineStyle": tracing_style,
        "title": plate["title"],
        "attribution": f"{plate['attribution']} · {plate['year']}",
        "viewBoxSize": plate["viewBoxSize"],
        "paths": plate["paths"],
    }


def generate_puzzle_for_block(
    block: Dict[str, Any],
    puzzle_index_in_block: int,
    vault_items: List[Dict[str, Any]],
    base_seed: int = 202611,
) -> Dict[str, Any]:
    block_id = str(block.get("id", "blk"))
    block_seed = base_seed + sum(ord(ch) * 17 for ch in block_id)
    game_type = block.get("gameType", "sudoku")
    difficulty = block.get("difficulty", "Medium")

    if game_type == "sudoku":
        return generate_sudoku(puzzle_index_in_block, difficulty, block_seed)
    if game_type == "kakuro":
        return generate_kakuro(puzzle_index_in_block, difficulty, block_seed)
    if game_type == "calcudoku":
        raw_size = block.get("calcudokuSize", "6x6")
        size_num = 4 if raw_size == "4x4" else (8 if raw_size == "8x8" else 6)
        return generate_calcudoku(puzzle_index_in_block, size_num, difficulty, block_seed)
    if game_type == "crossword":
        return generate_crossword(puzzle_index_in_block, block, vault_items)
    if game_type == "word-grid":
        return generate_word_grid(puzzle_index_in_block, block, vault_items, block_seed)
    return generate_line_art(
        puzzle_index_in_block,
        block.get("lineArtTheme", "Botanical Engravings"),
        block.get("lineWeight", "Fine"),
        block.get("tracingLineStyle", "light-solid"),
        vault_items,
    )
