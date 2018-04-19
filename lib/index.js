import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import Network from './Network';
import Timelapse from './Timelapse';
import Mousetrap from 'mousetrap';
import spec from './locales.json';
import config from 'config.json';
import {locale, navigation, navbar, spinner} from '@gros/visualization-ui';

const locales = new locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));

axios.get('data/intervals.json').then(response => {
    let intervals = response.data;

    let network = new Network(locales);
    network.create();

    let options = d3.select('#options');
    let timelapse = new Timelapse(network, intervals, locales, options);
    timelapse.create();

    // Add a button to filter external people out
    options.append("button")
        .classed("regular-option", true)
        .text(locales.message('toggle-extern'))
        .attr('title', locales.message('toggle-extern-title'))
        .on("click", () => network.toggleExtern());

    options.append("input")
        .classed("regular-option", true)
        .attr("type", "search")
        .attr("placeholder", locales.message("search-placeholder"))
        .on("input", function() {
            let node = this;
            network.find(node.value).then(function() {
                node.setCustomValidity("");
            }, function() {
                node.setCustomValidity(locales.message("search-invalid"));
            });
        });
});

locales.updateMessages();

window.buildNavigation(navbar, locales, config);
