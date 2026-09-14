// One-time migration from the exact redundant wrappers in release 9b816b7.
// Nothing else in deploy/, or in Vercel's deployment history, may be removed.
export const retiredFunctions = Object.freeze({
  "deploy/api/catalog/check.py": "65ab73af82658d474c7d5d39fcb69ad783ead80a",
  "deploy/api/check-studio.py": "325f161dba3b427e85cd826ddc60ad006402ff01",
  "deploy/api/commerce.py": "07d5ba379524fe01fe95ae43de85b4105600bef1",
  "deploy/api/proof.py": "ef97ed3898f429a3f3d5d2dab2b089a970f5bb29",
  "deploy/api/provider-review.py": "9b83c12b9c3fb364402963ca73b98344734f6543",
  "deploy/api/recorded.py": "e8ee7111d3e192004e7561dc784b90b2679a31d5",
  "deploy/api/runtime.py": "03c13f6cf8384f79c5c8eaa47b20533b3a1d5c5c",
  "deploy/api/session/config.py": "306f1667bb5bbc24190852a291acb84a1a49e51a",
  "deploy/api/session/inspect.py": "d6d56d8a40459bda815bcf33b35021522921fe41",
  "deploy/api/session/prepare.py": "25d4cf7e944830d756519d1bf2e5ee884e69f360",
  "deploy/api/session/receipt.py": "ee49c76c9930cf2774ffea643e63cb2c48da862b"
});

export function planRetiredFunctions(remoteTree, nextPaths) {
  const next = new Set(nextPaths);
  const deletions = [];
  for (const row of remoteTree) {
    if (!row.path.startsWith("deploy/") || row.type === "tree" || next.has(row.path)) continue;
    if (!Object.hasOwn(retiredFunctions, row.path) || row.type !== "blob" || row.mode !== "100644" || row.sha !== retiredFunctions[row.path])
      throw Error("Unexpected existing deployment file or changed wrapper: " + row.path);
    deletions.push({path: row.path, mode: "100644", type: "blob", sha: null});
  }
  return deletions;
}
