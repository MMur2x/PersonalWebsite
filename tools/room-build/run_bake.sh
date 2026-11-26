#!/bin/bash
# runs every bake piece in its own Blender process
B="/c/Program Files/Blender Foundation/Blender 5.3/blender.exe"
A="/c/Users/Owner/Project_s/Code Projects/Portfolio Personal Website/art-source"
S="/c/Users/Owner/AppData/Local/Temp/claude/727c9a8b9fa813fe/0f00b2cf-4638-4fe3-86e6-b2ea3ac75b6d/scratchpad/bake_all.py"
OUT="C:/Users/Owner/Project_s/Code Projects/Portfolio Personal Website/art-source/bake"
AREAS="walls floor desk deskwall window bed leftwall rightwall frontwall center outdoor"
run() { "$B" -b "$A/mayne-room_bake.blend" --python "$S" -- "$OUT" "$1" "$2" >> "$A/bake/blender_stdout.txt" 2>&1 || echo "FAILED $1 $2" >> "$A/bake/bake_log.txt"; }
for g in $AREAS; do run mat $g; done
for L in night practical desklamp day; do
  for g in $AREAS books libbooks; do
    if [ "$g" = outdoor ] && { [ "$L" = practical ] || [ "$L" = desklamp ]; }; then continue; fi
    if [ -f "$A/bake/${g}_lm_${L}.exr" ]; then continue; fi
    run $L $g
  done
  run $L vertex
done
echo ALL_PIECES_DONE >> "$A/bake/bake_log.txt"
