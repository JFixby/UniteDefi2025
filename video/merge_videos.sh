#!/bin/bash

# Create a file list for ffmpeg concat
cat > filelist.txt << EOF
file '1.mov'
file '2.mov'
file '3.mov'
EOF

# Merge the videos using ffmpeg concat demuxer
ffmpeg -f concat -safe 0 -i filelist.txt -c copy merged_video.mov

# Clean up the temporary file list
rm filelist.txt

echo "Videos merged successfully into merged_video.mov" 