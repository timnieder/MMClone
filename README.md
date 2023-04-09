A Game Framework to load and play MicroMacro-like maps and cases.
Uses Leaflet to show the map.

## TODO:
- mp:
    - sync case/map
    - let users set color
    - let users select name?
    - make connecting less cbt
    - ping?
- right click menu:
    - debug:
        - on circle: set color
- style markers
- help page
- fix bounds on small images
- mark solved cards better in ui
- fix pagination bullets being at the bottom
- make objective display better on mobile
- add shake on mobile/general cards after waiting too long?
- add case finish animation
- save case progress
- save settings
- optimize loading (zip limited?)
- support multi-steps (each step gets a "depends on" array? `step1.dependsOn = [step1,step2]`?)
- support steps with multiple needed solutions (`step.neededSolutions`?)

# How to create a map from a image
To transform a image to raster tiles you can use libvips with this command:

`vips dzsave <image name> --layout google --tile-size 256 --overlap 0 <output name> --suffix .png`


Problems:
- libvips v8.14.2 didn't work for me for some reason. i used v8.14.1
- if images are too small, you may need to adjust the zoom level manually. for a 1080x1920 image i had to use min zoom 8, max zoom 11