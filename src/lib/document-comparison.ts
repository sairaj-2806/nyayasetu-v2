import type { DocumentVersionRecord } from "@/lib/documents";

export interface VersionDiffLine {
  type: "added" | "removed" | "unchanged" | "header";
  text: string;
}

export interface VersionComparisonReport {
  versionA: DocumentVersionRecord;
  versionB: DocumentVersionRecord;
  sizeDiffBytes: number;
  sizeDiffFormatted: string;
  timeDiffFormatted: string;
  hashMatch: boolean;
  uploaderChanged: boolean;
  mimeTypeMatch: boolean;
  summaryComparison: {
    baseSummary: string;
    targetSummary: string;
  };
  textDiff: VersionDiffLine[];
}

export function compareDocumentVersions(
  versionA: DocumentVersionRecord,
  versionB: DocumentVersionRecord,
): VersionComparisonReport {
  // Compute size difference
  const sizeDiffBytes = versionB.file_size_bytes - versionA.file_size_bytes;
  const sign = sizeDiffBytes > 0 ? "+" : "";
  const sizeDiffFormatted = `${sign}${(sizeDiffBytes / 1024).toFixed(1)} KB`;

  // Compute time difference
  const timeA = new Date(versionA.created_at).getTime();
  const timeB = new Date(versionB.created_at).getTime();
  const diffHours = Math.abs(Math.round((timeB - timeA) / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);
  const timeDiffFormatted =
    diffDays > 0
      ? `${diffDays} day${diffDays > 1 ? "s" : ""} ${diffHours % 24} hr${diffHours % 24 !== 1 ? "s" : ""}`
      : `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;

  const hashMatch = versionA.sha256_hash === versionB.sha256_hash;
  const uploaderChanged = versionA.uploaded_by_name !== versionB.uploaded_by_name;
  const mimeTypeMatch = versionA.mime_type === versionB.mime_type;

  // Simple paragraph/line diff algorithm
  const textA = (versionA.content_text || "").split("\n").map((l) => l.trimEnd());
  const textB = (versionB.content_text || "").split("\n").map((l) => l.trimEnd());

  const textDiff: VersionDiffLine[] = [];
  const maxLines = Math.max(textA.length, textB.length);

  for (let i = 0; i < maxLines; i++) {
    const lineA = textA[i];
    const lineB = textB[i];

    if (lineA !== undefined && lineB !== undefined) {
      if (lineA === lineB) {
        textDiff.push({ type: "unchanged", text: lineA });
      } else {
        textDiff.push({ type: "removed", text: lineA });
        textDiff.push({ type: "added", text: lineB });
      }
    } else if (lineA !== undefined) {
      textDiff.push({ type: "removed", text: lineA });
    } else if (lineB !== undefined) {
      textDiff.push({ type: "added", text: lineB });
    }
  }

  return {
    versionA,
    versionB,
    sizeDiffBytes,
    sizeDiffFormatted,
    timeDiffFormatted,
    hashMatch,
    uploaderChanged,
    mimeTypeMatch,
    summaryComparison: {
      baseSummary: versionA.change_summary,
      targetSummary: versionB.change_summary,
    },
    textDiff,
  };
}
