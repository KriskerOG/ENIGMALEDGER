export function normalizeFuzzyText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-·・:：,，.。;；'"()[\]（）/]+/g, " ")
    .trim();
}

export function compactFuzzyText(value: string | number | null | undefined): string {
  return normalizeFuzzyText(value).replace(/\s+/g, "");
}

function boundedEditDistance(left: string, right: string, maxDistance: number): number {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMin = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const replaceCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const next = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + replaceCost
      );
      current[rightIndex] = next;
      rowMin = Math.min(rowMin, next);
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }

    previous = current;
  }

  return previous[right.length];
}

export function fuzzyTextScore(candidate: string | number | null | undefined, query: string | number | null | undefined): number {
  const normalizedCandidate = normalizeFuzzyText(candidate);
  const normalizedQuery = normalizeFuzzyText(query);
  const compactCandidate = compactFuzzyText(candidate);
  const compactQuery = compactFuzzyText(query);

  if (!normalizedCandidate || !normalizedQuery || !compactCandidate || !compactQuery) {
    return 0;
  }

  if (normalizedCandidate === normalizedQuery) {
    return 100;
  }

  if (compactCandidate === compactQuery) {
    return 96;
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 80;
  }

  if (compactCandidate.startsWith(compactQuery)) {
    return 76;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 60;
  }

  if (compactCandidate.includes(compactQuery)) {
    return 56;
  }

  if (compactQuery.length >= 3 && compactQuery.includes(compactCandidate)) {
    return 42;
  }

  if (compactQuery.length >= 4 && compactCandidate.length >= 4) {
    const maxDistance = compactQuery.length <= 6 ? 1 : 2;
    if (boundedEditDistance(compactCandidate, compactQuery, maxDistance) <= maxDistance) {
      return maxDistance === 1 ? 44 : 34;
    }
  }

  return 0;
}
