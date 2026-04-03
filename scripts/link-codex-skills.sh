#!/usr/bin/env bash
# link-codex-skills.sh
# Finds all skill directories under **/.agents/skills/*/ in this repo
# and creates directory junctions in ~/.codex/skills/
#
# Usage: bash scripts/link-codex-skills.sh


# Bu olmadan codex ve claude aynı anda skilleri bulamıyor.
# Script skilleri tarayıp home dizinine kopyalıyor. 

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CODEX_SKILLS_DIR="$(cygpath "$USERPROFILE")/.codex/skills/vnext-forge-skills"

echo "Repo root : $REPO_ROOT"
echo "Target    : $CODEX_SKILLS_DIR"
echo ""

mkdir -p "$CODEX_SKILLS_DIR"

linked=0
skipped=0
errors=0

# Find all SKILL.md files, sort, then deduplicate by skill name (first occurrence wins)
while IFS= read -r skill_md; do
  skill_dir="$(dirname "$skill_md")"
  skill_name="$(basename "$skill_dir")"
  target="$CODEX_SKILLS_DIR/$skill_name"

  if [ -e "$target" ] || [ -L "$target" ]; then
    echo "SKIP  $skill_name"
    skipped=$((skipped + 1))
    continue
  fi

  win_target="$(cygpath -w "$target")"
  win_source="$(cygpath -w "$skill_dir")"

  result=$(powershell.exe -NoProfile -NonInteractive -Command \
    "New-Item -ItemType Junction -Path '$win_target' -Target '$win_source' -Force -ErrorAction SilentlyContinue | Out-Null; exit \$LASTEXITCODE" \
    2>&1 < /dev/null)

  if [ $? -eq 0 ]; then
    echo "LINK  $skill_name"
    linked=$((linked + 1))
  else
    echo "ERROR $skill_name  ($result)"
    errors=$((errors + 1))
  fi

done < <(find "$REPO_ROOT" -path "*/.agents/skills/*/SKILL.md" | sort | awk -F'/' '!seen[$(NF-1)]++')

echo ""
echo "Done: $linked linked, $skipped skipped, $errors errors"
