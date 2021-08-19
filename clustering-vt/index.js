#! /usr/bin/env node

/**
 * This tool takes a GeoJSON FeatureCollection as input through stdin.
 * It parses and extract the features and then generates clusters with SuperCluster: https://github.com/mapbox/supercluster
 * All possible tiles (z, x, y) are extracted from the generated clusters index and are saved as pbf files under the
 * output_dir given as parameter when executing the tool.
 */

const { program } = require('commander')
const Supercluster = require('supercluster');
const VTpbf = require('vt-pbf');
const fs = require('fs');
const { execSync } = require('child_process');

const MAX_ZOOM = 5;

var features = [];

program
    .command('generate <radius> <output_dir>')
    .description('Generates the clusters and creates vector tiles in the given output-dir.')
    .action(generate);
    
function generate(radius, output_dir) {
    if(!features) {
        throw new Error('A FeatureCollection should be sent through stdin.');
    }

    const superCluster = new Supercluster({ radius: radius, maxZoom: MAX_ZOOM, extent: 256 });
    console.time('Clusters generation');
    const clusteredFeatures = superCluster.load(features);
    features = [] //Clear features which are not used anymore.
    console.timeEnd('Clusters generation');

    console.time('Vector tiles creation')
    for (let z = 0; z <= MAX_ZOOM + 1; z++) {
        const zoomDimension = Math.pow(2, z); // Number of max tiles is 2^z * 2^z -> https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
        //Remove the output_dir/{z} if it already exists
        fs.rmSync(`${output_dir}/${z}`, { recursive: true, force: true });

        for (let x = 0; x < zoomDimension; x++) {
            for (let y = 0; y < zoomDimension; y++) {

                const tile = clusteredFeatures.getTile(z, x, y);
                
                //Do not serialize empty tiles.
                if (!tile || !tile.features) {
                    continue;
                }

                //Add the cluster expansion zoom to the properties of the feature if its a cluster.
                for (const feature of tile.features) {
                    if (feature.tags.cluster_id) {
                        feature.tags['clusterExpansionZoom'] = clusteredFeatures.getClusterExpansionZoom(feature.tags.cluster_id);
                    }
                }

                var pbfData = VTpbf.fromGeojsonVt({ 'clusterLayer': tile }, { extent: 256 });
                // const vtFeatureCollection = {
                //     'type': 'FeatureCollection',
                //     'properties': {
                //         'zoom': 0,
                //         'x': x,
                //         'y': y,
                //         'compressed': false
                //     },
                //     'features': [
                //         {
                //             'type': 'FeatureCollection',
                //             'properties': {
                //                 'layer': 'clusterLayer',
                //                 'version': 1,
                //                 'extent': 256
                //             },
                //             'features': tile.features
                //         }
                //     ]
                // }
                execSync('python3 python-vt.py --output ' + `${output_dir}/${z}/${x}/${y}.pbf`, { cwd: __dirname, input: JSON.stringify(tile.features)});
                //fs.mkdirSync(`${output_dir}/${z}/${x}`, { recursive: true });
                fs.writeFileSync(`${output_dir}/${z}/${x}/${y}real.pbf`, pbfData);
                //fs.writeFileSync(`${output_dir}/file.json`, JSON.stringify(tile.features));
            }
        }
    }
    console.timeEnd('Vector tiles creation');
}

// Read data from stdin before parsing the args
if(process.stdin.isTTY) {
    program.parse(process.argv);
} else {
    var currentBuffer = "";
    var startParsing = false;

    process.stdin.on('readable', function() {
        var chunk = this.read(); 
        if (chunk !== null) {
            //Parse the FeatureCollection input to extract all features
            chunk.forEach(element => {
                currentBuffer += String.fromCharCode(element);
                //Ignore the beggining of the FeatureCollection
                if (currentBuffer.endsWith('"features": [')) {
                    currentBuffer = "";
                    startParsing = true;
                }
                if (startParsing) {
                    //Check that we reached a new Feature
                    if (currentBuffer.endsWith('{"type": "Feature"')) {
                        //Check that this is not the first Feature
                        if(currentBuffer.length > 18) {
                            const strFeatureToParse = currentBuffer.slice(0, -20); // remove the last part = ,{"type": "Feature"
                            currentBuffer = currentBuffer.slice(-18); //Keep only {"type": "Feature"
                            feature = JSON.parse(strFeatureToParse);
                            features.push(feature);
                        }
                    }
                }
            });
        }
    });
    process.stdin.on('end', function() {
        //Parse the last feature
        currentBuffer = currentBuffer.slice(0, -2); // remove the ]} at the end of the FeatureCollection JSON
        feature = JSON.parse(currentBuffer);
        features.push(feature);
        program.parse(process.argv); 
    });
}