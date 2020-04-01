#!/bin/bash
for dir in raw/hh_human_fx/*
do
  name=`basename $dir`
  TexturePacker $dir --format pixijs4 --sheet dist/$name/$name.png --data dist/$name/$name.json
done