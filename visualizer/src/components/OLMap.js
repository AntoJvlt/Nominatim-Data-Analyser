import { useEffect, useState, useRef } from "react"
import 'ol/ol.css';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import Point from 'ol/geom/Point';
import SourceVector from 'ol/source/Vector';
import LayerVector from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import { fromLonLat, transform } from 'ol/proj';
import Icon from 'ol/style/Icon';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import { Style, Circle, Stroke, Fill, Text } from "ol/style";
import MVT from 'ol/format/MVT';

const OLMap = () => {
    const [map, setMap] = useState()
    const mapContainer = useRef()
    const style = new Style({image: new Circle({fill: new Fill({color: 'rgba(255,84,71,1)'}), radius: 5})})
    useEffect(() => {
        //Vector tiles
        const styleCache = {};
        const vtLayer = new VectorTileLayer({
            declutter: true,
            source: new VectorTileSource({
              format: new MVT({
                featureClass: Feature
              }),
              url: 'https://gsoc2021-qa.nominatim.org/QA-data/BA_way_not_part_relation/vector-tiles/{z}/{x}/{y}.pbf'
            }),
            style: style
        });
        //Map
        const initialMap = new Map({
            layers: [
                new TileLayer({
                source: new OSM(),
                }),
                vtLayer
            ],
            target: mapContainer.current,
            view: new View({
                center: transform([0, 0], 'EPSG:4326', 'EPSG:3857'),
                zoom: 2,
            })
        })
        setMap(initialMap)
    }, [])

    return (
        <section ref={mapContainer} id='map'></section>
    )
}

export default OLMap
