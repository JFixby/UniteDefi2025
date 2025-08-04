#!/bin/bash

# Speed up the merged video by 15%
# To speed up by 15%, we need to set the speed to 1.15x
# This means the video will play 15% faster than the original

ffmpeg -i merged_video.mov -filter_complex "[0:v]setpts=0.869565*PTS[v];[0:a]atempo=1.15[a]" -map "[v]" -map "[a]" merged_video_fast.mov

echo "Video speeded up by 15% and saved as merged_video_fast.mov" 