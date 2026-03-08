export function colLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + letter.charCodeAt(i) - 64;
  }
  return result - 1;
}

export function indexToColLetter(index: number): string {
  let temp = index;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Parses A1:B2 into an array of cell ids like ['A1', 'A2', 'B1', 'B2']
export function parseRange(rangeStr: string): string[] {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return [];

  const startMatch = parts[0].match(/([A-Z]+)([0-9]+)/);
  const endMatch = parts[1].match(/([A-Z]+)([0-9]+)/);

  if (!startMatch || !endMatch) return [];

  const startCol = colLetterToIndex(startMatch[1]);
  const startRow = parseInt(startMatch[2], 10);
  const endCol = colLetterToIndex(endMatch[1]);
  const endRow = parseInt(endMatch[2], 10);

  const cells: string[] = [];
  for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
    for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
      cells.push(`${indexToColLetter(c)}${r}`);
    }
  }

  return cells;
}

// Evaluates a single formula string. 
// Uses a simple approach to evaluate safe expressions.
export function evaluateFormula(
  formula: string,
  getCellValue: (cellId: string) => string | number,
  visited: Set<string> = new Set()
): string | number {
  if (!formula.startsWith("=")) return formula;

  let expression = formula.substring(1).trim().toUpperCase();

  // Find all function calls like SUM(A1:B2) or AVERAGE(A1, C3)
  const funcRegex = /(SUM|AVERAGE|COUNT|MAX|MIN|PRODUCT)\(([^)]+)\)/g;
  expression = expression.replace(funcRegex, (match, funcName, rangeGroup) => {
    const values: number[] = [];
    
    // rangeGroup could be A1:B2 or A1,B2,C3
    const args = rangeGroup.split(",").map((s: string) => s.trim());
    for (const arg of args) {
      if (arg.includes(":")) {
        const cells = parseRange(arg);
        for (const cell of cells) {
          const val = resolveCellOrValue(cell, getCellValue, visited);
          if (!isNaN(val)) values.push(val);
        }
      } else {
        const val = resolveCellOrValue(arg, getCellValue, visited);
        if (!isNaN(val)) values.push(val);
      }
    }

    if (values.length === 0) return "0";

    let result = 0;
    switch (funcName) {
      case "SUM":
        result = values.reduce((acc, curr) => acc + curr, 0);
        break;
      case "AVERAGE":
        result = values.reduce((acc, curr) => acc + curr, 0) / values.length;
        break;
      case "COUNT":
        result = values.length;
        break;
      case "MAX":
        result = Math.max(...values);
        break;
      case "MIN":
        result = Math.min(...values);
        break;
      case "PRODUCT":
        result = values.reduce((acc, curr) => acc * curr, 1);
        break;
    }
    return result.toString();
  });

  // Replace cell references with their values
  // e.g. A1 + B2 -> 5 + 10
  const cellRefRegex = /[A-Z]+[0-9]+/g;
  expression = expression.replace(cellRefRegex, (match) => {
    return resolveCellOrValue(match, getCellValue, visited).toString();
  });

  try {
    // Only allow safe math chars 
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return "#ERROR";
    }
    // Safe evaluation using Function
    const result = new Function(`return ${expression}`)();
    return Number.isFinite(result) ? result : "#ERROR";
  } catch (error) {
    return "#ERROR";
  }
}

function resolveCellOrValue(
  ref: string, 
  getCellValue: (id: string) => string | number,
  visited: Set<string>
): number {
  if (!/^[A-Z]+[0-9]+$/.test(ref)) {
    return Number(ref) || 0;
  }

  if (visited.has(ref)) {
    throw new Error("#CYCLE");
  }

  const rawVal = getCellValue(ref);
  if (typeof rawVal === "string" && rawVal.startsWith("=")) {
    visited.add(ref);
    try {
      const res = evaluateFormula(rawVal, getCellValue, visited);
      visited.delete(ref);
      return Number(res) || 0;
    } catch {
      visited.delete(ref);
      return 0;
    }
  }

  return Number(rawVal) || 0;
}
