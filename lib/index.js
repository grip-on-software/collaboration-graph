/**
 * Main entry point for the Collaboration graph visualization.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
 * Copyright 2017-2023 Leon Helwerda
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import {TOOLTIP_ATTR} from './attrs';
import Network from './Network';
import Timelapse from './Timelapse';
import spec from './locales.json';
import config from 'config.json';
import {Locale, Navbar} from '@gros/visualization-ui';

// Select locale from query parameter
const locales = new Locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));

axios.get('data/intervals.json').then(response => {
    const intervals = response.data;

    // Set up the network layout and resizing
    const network = new Network(locales);
    network.create();

    d3.select(window).on("resize", () => {
        requestAnimationFrame(() => network.resize());
    });

    // Enable timelapse options
    const options = d3.select('#options');
    const timelapse = new Timelapse(network, intervals, locales, options);
    timelapse.create();

    // Augment the options
    const column = options.append('div')
        .classed('column is-narrow', true)
        .append('div')
        .classed('field is-grouped', true);

    // Add a button to filter external people out
    column.append("p")
        .classed("control tooltip", true)
        .attr(TOOLTIP_ATTR, locales.message('toggle-extern-title'))
        .append("button")
        .attr("id", "toggle-extern-button")
        .classed("button is-small regular-option", true)
        .text(locales.message('toggle-extern'))
        .on("click", function () {
            const extern = network.toggleExtern();
            d3.select(this).classed("is-link is-selected", extern);
        });

    // Add a search bar for finding persons by their common name. This only
    // works if the data is unencrypted or if there is an encryption service.
    const title = locales.message(network.allEncrypted && !config.encrypt_url ?
        "search-title-anonymous" : "search-title"
    );
    const invalid = locales.message("search-invalid");
    const search = column.append("p")
        .classed("control tooltip has-icons-right", true)
        .attr(TOOLTIP_ATTR, title);
    search.append("label")
        .attr("for", "search")
        .classed("is-sr-only", true)
        .text(title);
    search.append("input")
        .attr("id", "search")
        .classed("input is-small regular-option", true)
        .attr("type", "search")
        .attr("placeholder", locales.message("search-placeholder"))
        .on("input", function() {
            const node = this;
            network.find(node.value).then(function() {
                node.setCustomValidity("");
                d3.select(node.parentNode)
                    .classed("has-tooltip-active has-tooltip-danger", false)
                    .attr(TOOLTIP_ATTR, title);
                d3.select(node)
                    .classed("is-success", true)
                    .classed("is-danger", false);
            }, function() {
                node.setCustomValidity(invalid);
                d3.select(node.parentNode)
                    .classed("has-tooltip-active has-tooltip-danger", true)
                    .attr(TOOLTIP_ATTR, invalid);
                d3.select(node)
                    .classed("is-success", false)
                    .classed("is-danger", true);
            });
        });
    search.append("span")
        .classed("icon is-right", true)
        .append("i")
        .classed("far fa-times-circle", true)
        .on("click", function() {
            d3.select(this.parentNode.parentNode)
                .select("#search")
                .property("value", "")
                .dispatch("input");
        });
});

locales.updateMessages();

if (typeof window.buildNavigation === "function") {
    window.buildNavigation(Navbar, locales, _.assign({}, config, {
        visualization: "collaboration-graph"
    }));
}
