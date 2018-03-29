import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';
import Network from './Network';
import Mousetrap from 'mousetrap';
import spec from './locales.json';
import config from 'config.json';
import {locale, navigation, navbar, spinner} from '@gros/visualization-ui';

const locales = new locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));

moment.locale(locales.lang);

const intervalFile = id => `data/project_members/project_members-interval-${id}.json`;

let intervals = [];

axios.get('data/intervals.json').then(response => {
    intervals = response.data;

    let network = new Network(locales);
    network.create();

    let timelapseTimer = null;

    let options = d3.select('#options');

    let timelapseButton = options.append("button")
        .text(locales.message("timelapse"))
        .on("click", () => {
            if (timelapseTimer) {
                timelapseTimer.stop();
                timelapseTimer = null;

                timelapseButton.text(locales.message("timelapse"));
                
                options.selectAll('.regular-option')
                    .attr('disabled', null);
                options.selectAll('.timelapse-option')
                    .remove();

                network.stopTimelapse();
                network.create();
            }
            else {
                timelapseButton.text(locales.message("timelapse-complete"));

                options.selectAll('.regular-option')
                    .attr('disabled', true);

                // Initialize the timelapse
                network.startTimelapse(intervalFile(intervals[9]));

                // Create the heading for the date indication
                let h3 = options.append('h3')
                    .classed('timelapse-option', true);

                let index = 0;
                let paused = false;
                let speed = 1500; // Default speed is one tick per 1.5 seconds. Lower is faster.

                // This callback will be invoked for each timer tick
                let callback = () => {
                    if (paused) {
                        timer.stop();
                    }
                    else if (index < intervals.length) {
                        let d = new Date(0);
                        d.setUTCSeconds(intervals[index]);

                        h3.text(`${moment(d).format('MMMM YYYY')}`);

                        network.timelapseTick(intervalFile(intervals[index]), moment(d));

                        index++;
                    }
                    else {
                        d3.select('#pauseButton')
                            .attr('disabled', true)
                            .attr('title', locales.message('stop-title'))
                            .text('■');
                    }
                };

                // Start the timelapse
                callback();
                timelapseTimer = d3.interval(callback, speed, d3.now());

                // Toggles the play/pause setting
                let togglePlayPause = () => {
                    if (paused) {
                        paused = false;
                        callback();
                        timelapseTimer = d3.interval(callback, speed, d3.now());
                        d3.select("#pauseButton").text('❚❚')
                            .attr('title', locales.message('pause-title'));
                    } else {
                        paused = true;
                        d3.select("#pauseButton").text('►')
                            .attr('title', locales.message('play-title'));
                    }
                };

                // Add a play/pause button to the timelapse
                options.append("button")
                    .classed("timelapse-option", true)
                    .attr("id", "pauseButton")
                    .text("❚❚")
                    .attr('title', locales.message('pause-title'))
                    .on("click", togglePlayPause);
                
                let highestSpeed = 500; // Max speed is ticking each 0.5 seconds
                let lowestSpeed = 4000; // Lowest speed is 4 seconds

                // Decrease the timelapse speed one step, if above threshold
                let decreaseSpeed = () => {
                    if (speed < lowestSpeed) {
                        speed += 500;
                        timelapseTimer.stop();
                        timelapseTimer = d3.interval(callback, speed, d3.now());

                        if (speed > highestSpeed) {
                            d3.select(".speedButton.faster").attr("disabled", null);
                        }
                    } else {
                        d3.select(".speedButton.slower").attr("disabled", true);
                    }
                };

                // Increase the timelapse speed one step, if below theshold
                let increaseSpeed = () => {
                    if (speed > highestSpeed) {
                        speed -= 500;
                        timelapseTimer.stop();
                        timelapseTimer = d3.interval(callback, speed, d3.now());

                        if (speed < lowestSpeed) {
                            d3.select(".speedButton.slower").attr("disabled", null);
                        }
                    } else {
                        d3.select(".speedButton.faster").attr("disabled", true);
                    }
                };

                options.append("button")
                    .attr("class", "speedButton slower timelapse-option")
                    .text("-")
                    .attr('title', locales.message('speed-slower-title'))
                    .on("click", decreaseSpeed);
                
                options.append("button")
                    .attr("class", "speedButton faster timelapse-option")
                    .text("+")
                    .attr('title', locales.message('speed-faster-title'))
                    .on("click", increaseSpeed);

                // Keyboard shortcuts for timelapse options
                Mousetrap.bind(['+', '=', 'plus'], increaseSpeed);
                Mousetrap.bind('-', decreaseSpeed);
                Mousetrap.bind('0', togglePlayPause);
            }
        });

    // Add a button to filter external people out
    let externButton = options.append("button")
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
