import React from "react";
import HeatmapOverlay from "leaflet-heatmap";
import {makeApiGet} from "../common/Api";
import {numberToColorRgb} from "../common/Utils";

export default class IndexPage extends React.Component {
    constructor(state, props) {
        super(state, props);

        this.state = {
            max: -1000,
            min: 1000,

            rawPoints: [],
            modelPoints: [],

            showRawData: true,
            showModelData: false,
        };

        this.baseLayer;
        this.heatmapLayer;
        this.map;
    }

    componentWillMount() {
        this.baseLayer = L.tileLayer(
            'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
                attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox.streets',
                accessToken: 'pk.eyJ1IjoienVpcmlzIiwiYSI6ImNqOXpoMXQxdDZhaGYzM3Bna2Z5eHoxMTIifQ.bEG8N1zXKtOA3RGxDoe9tg'
            }
        );

        let cfg = {
            radius: 0.08,
            maxOpacity: 0.8,
            scaleRadius: true,
            useLocalExtrema: false,
            latField: 'lat',
            lngField: 'lng',
            valueField: 'count'
        };

        this.heatmapLayer = new HeatmapOverlay(cfg);
    }

    componentDidMount() {
        this.map = new L.Map('map', {
            zoomControl: false,
            center: new L.LatLng(50.7343800, 7.0954900),
            zoom: 5,
            layers: [this.baseLayer, this.heatmapLayer]
        });

        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        if (this.state.showRawData) {
            this.makeApiCall('/api/getRawData', 'rawPoints');
        }

        if (this.state.showModelData) {
            this.makeApiCall('/api/getModelData', 'modelPoints');
        }
    }

    componentWillUnmount() {
        this.map = null;
    }

    getAndParseRawData() {
        makeApiGet('/api/getRawData').then((data) => {
            let min = this.state.min;
            let max = this.state.max;

            const points = data.results.map(entry => {
                if (entry.value > max) {
                    max = entry.value;
                } else if (entry.value < min) {
                    min = entry.value;
                }

                return {
                    lat: entry.coordinates.latitude,
                    lng: entry.coordinates.longitude,
                    count: entry.value
                }
            });

            let newState = Object.assign({}, this.state, {min, max});
            newState['rawPoints'] = points;
            this.setState(newState);
        });
    }

    getAndParseModelData() {
        makeApiGet('/api/getModelData').then((data) => {
            let min = this.state.min;
            let max = this.state.max;

            const shapes = data.results.map(entry => {
                if (entry.value > max) {
                    max = entry.value;
                } else if (entry.value < min) {
                    min = entry.value;
                }

                return {
                    lat: entry.coordinates.latitude,
                    lng: entry.coordinates.longitude,
                    count: entry.value
                }
            });

            let newState = Object.assign({}, this.state, {min, max});
            newState['modelPoints'] = shapes;
            this.setState(newState);
        });
    }


    makeApiCall(url, typeOfData) {
        makeApiGet(url).then((data) => {
            let min = this.state.min;
            let max = this.state.max;

            const points = data.results.map(entry => {
                if (entry.value > max) {
                    max = entry.value;
                } else if (entry.value < min) {
                    min = entry.value;
                }

                return {
                    lat: entry.coordinates.latitude,
                    lng: entry.coordinates.longitude,
                    count: entry.value
                }
            });

            let newState = Object.assign({}, this.state, {min, max});
            newState[typeOfData] = points;
            this.setState(newState);
        });
    }

    getData(buttonName) {
        switch (buttonName) {
            case "showRawData":
                this.getAndParseRawData();
                break;
            default:
                this.getAndParseModelData();
                break;
        }
    }

    toggleButton(buttonName) {
        let newState = Object.assign({}, this.state);
        newState[buttonName] = !newState[buttonName];

        this.getData(buttonName);

        this.setState(newState);
    }

    prepareData() {
        let result = [];

        if (this.state.showRawData) {
            result = result.concat(this.state.rawPoints);
        }

        if (this.state.showModelData) {
            result = result.concat(this.state.modelPoints);
        }

        return result;
    }

    getDotColor(value) {
        let percent = Math.floor(value * 100 / Math.abs(this.state.max - this.state.min));
        return numberToColorRgb(100 - percent);
    }

    render() {
        if (this.state.showRawData) {
            this.state.rawPoints.map(point => {
                let color = this.getDotColor(point.count);
                L.circle([point.lat, point.lng], {
                    radius: 100,
                    color: color,
                    fillColor: color,
                    fill: 1,
                    fillOpacity: 0.3,
                    opacity: 0.3
                }).addTo(this.map);
            })
        } else {
            this.state.rawPoints.map(point => {
                let color = this.getDotColor(point.count);
                L.polygon([point.lat, point.lng], {
                    radius: 100,
                    color: color,
                    fillColor: color,
                    fill: 1,
                    fillOpacity: 0.3,
                    opacity: 0.3
                }).addTo(this.map);
            });

            // create a red polygon from an array of LatLng points
            var latlngs = [[37, -109.05], [41, -109.03], [41, -102.05], [37, -102.04]];
            var polygon = L.polygon(latlngs, {color: 'red'}).addTo(map);
// zoom the map to the polygon
            map.fitBounds(polygon.getBounds());
            // let data = {
            //     max: this.state.max,
            //     min: this.state.min,
            //     data: this.prepareData()
            // };
            //
            // this.heatmapLayer.setData(data);
        }

        let rawDataClass = (this.state.showRawData) ? "btn btn-block btn-success" : "btn btn-block btn-outline-success";
        let modelDataClass = (this.state.showModelData) ? "btn btn-block btn-success" : "btn btn-block btn-outline-success";

        let rawDataValue = (this.state.showRawData) ? "Hide raw data" : "Show raw data";
        let modelDataValue = (this.state.showModelData) ? "Hide model data" : "Show model data";

        return (
            <div className="app-wrapper">
                <div id="map"/>
                <div id="leaflet-buttons-wrapper">
                    <input type="button" className={rawDataClass} value={rawDataValue}
                           onClick={() => {
                               this.toggleButton("showRawData");
                           }}
                    />
                    <input type="button" className={modelDataClass} value={modelDataValue}
                           onClick={() => {
                               this.toggleButton("showModelData");
                           }}
                    />
                </div>
            </div>
        );
    }
}