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

    d3.select(window).on("resize", () => {
        requestAnimationFrame(() => network.resize());
    });

    let options = d3.select('#options');
    let timelapse = new Timelapse(network, intervals, locales, options);
    timelapse.create();

    let column = options.append('div')
        .classed('column is-narrow', true)
        .append('div')
        .classed('field is-grouped', true);

    // Add a button to filter external people out
    column.append("p")
        .classed("control tooltip", true)
        .attr('data-tooltip', locales.message('toggle-extern-title'))
        .append("button")
        .classed("button is-small regular-option", true)
        .text(locales.message('toggle-extern'))
        .on("click", function () {
            const extern = network.toggleExtern();
            d3.select(this).classed("is-info is-selected", extern); 
        });

    column.append("p")
        .classed("control tooltip", true)
        .attr("data-tooltip", locales.message("search-title"))
        .append("input")
        .classed("input is-small regular-option", true)
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
