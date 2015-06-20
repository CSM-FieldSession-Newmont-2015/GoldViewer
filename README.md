To see it in action, click [here](http://csm-fieldsession-newmont-2015.github.io/GoldViewer/).

# Gold Viewer

For an overview of design decisions and technical details about the code, please view [the wiki](https://github.com/CSM-FieldSession-Newmont-2015/GoldViewer/wiki).

## Basic Setup

To use GoldViewer, you can use the [demo](http://csm-fieldsession-newmont-2015.github.io/GoldViewer/), or setup your own server.

For personal use, you can use Python to run a local server. You may wish to do this if you want to make changes to Gold Viewer.

With Python 3 (on port `8000`):
````
python -m http.server 8000
````

With Python 2:
```
python -m SimpleHTTPServer 8000
```

The page is then available at http://127.0.0.1:8000.

For information on setting-up data files see the [jsondh project](https://github.com/cokrzys/jsondh).

## Controls

When it first loads, you will see a selection of mining properties to load. This list is saved in [/data/Datasets.json](https://github.com/CSM-FieldSession-Newmont-2015/GoldViewer/blob/master/data/Datasets.json), and must be modified manually to add new ones.

Click on a a property to load it. We recommend Mt Pleasant South - although it's large and takes a while to load the first time, it's by far the best one, visually. On the first load, it will fetch terrain data from Google, cache it, and then load the geometries for the minerals to render. Expect this to take ~30-60 seconds depending on your computer's processor. Please note, this is very memory intensive and may not load on older machines or Internet Explorer.

#### Mouse Controls

After everything has loaded, you will see the scene rotating. To disable rotation, click any mouse button, or the far right button on the bottom left of the screen. We use the three.js [OrbitControls]() library to handle most mouse input. Its controls are pretty straight forward:

- *Left click* to rotate the model
- *Right click* to pan around the model
- Scroll with the *mouse wheel* to zoom in or out on the model
- *Click both right and left* to toggle rotating the model

All three of these happen relative to a small yellow orb, which may be hard to see at a distance. Zoom in to see it better. As you zoom in, note that it gives off light, making it easier to see the surrounding minerals.

You can also navigate by hoving over minerals until they turn pink, and then clicking on them. This will move the center of your view, the yellow reticle orb, until it just barely touches the minerals.

#### Buttons

As mentioned earlier, there are some buttons on the bottom left of the screen. From left going right, they:

- Zoom in
- Zoom out
- Toggle rotating the model
- Toggle the terrain mesh
- Toggle the survey holes
 
#### Sidebar

Click on the striped, blue bar on the left side of the screen to open the sidebar. Here you will find a description of the property - taken from the jsondh file - along with histograms for each type of mineral in the property. The concentrations (in grams per ton) are on the bottom axis, spaced logarithmicly. Numbers at the top of bars indiciate how many instances fall into each bin. 

Above the histogram, we see a checkbox to toggle the visibility of that mineral, the name of the mineral, and the color with which it is rendered in the model. Each histogram has sliders, which can be used to draw only a subset of the data. This can be useful to remove outliers or limit the view to desirable mineral concentrations.
