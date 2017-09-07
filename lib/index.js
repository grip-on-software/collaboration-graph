import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';
import Network from './Network';
import Mousetrap from 'mousetrap';

moment.locale('nl');

const intervalFile = id => `data/project_members/project_members-interval-${id}.json`;

let intervals = [];

axios.get('data/intervals.json').then(response => {
	intervals = response.data;

	let network = new Network;
	network.create();

	let timelapseMode = false;

	d3.select("#options")
		.append("button")
		.text("Timelapse")
		.on("click", () => {
			if (!timelapseMode) {
				timelapseMode = true;

				// Initialize the timelapse
				network.startTimelapse(intervalFile(intervals[9]));

				// Create the heading for the date indication
				let h3 = d3.select('#options')
					.append('h3');

				let index = 0;
				let paused = false;
				let speed = 1500; // Default speed is one tick per 1.5 seconds. Lower is faster.

				// This callback will be invoked for each timer tick
				let callback = () => {
					if (index < intervals.length) {
						let d = new Date(0);
						d.setUTCSeconds(intervals[index]);

						h3.text(`${moment(d).format('MMMM YYYY')}`)

						network.timelapseTick(intervalFile(intervals[index]), moment(d));

						index++;
					}

					if (paused) {
						timer.stop();
					}
				};

				// Start the timelapse
				let timer = d3.interval(callback, speed, d3.now());

				// Toggles the play/pause setting
				let togglePlayPause = () => {
					if (paused) {
						paused = false;
						timer = d3.interval(callback, speed, d3.now());
						d3.select("#pauseButton").text('❚❚');
					} else {
						paused = true;
						d3.select("#pauseButton").text('►');
					}
				}

				// Add a play/pause button to the timelapse
				d3.select("#options")
					.append("button")
					.attr("id", "pauseButton")
					.text("❚❚")
					.on("click", togglePlayPause);
				
				let highestSpeed = 500; // Max speed is ticking each 0.5 seconds
				let lowestSpeed = 4000; // Lowest speed is 4 seconds

				// Decrease the timelapse speed one step, if above threshold
				let decreaseSpeed = () => {
					if (speed < lowestSpeed) {
						speed += 500;
						timer.stop();
						timer = d3.interval(callback, speed, d3.now());

						if (speed > highestSpeed) {
							d3.select(".speedButton.faster").attr("disabled", null);
						}
					} else {
						d3.select(".speedButton.slower").attr("disabled", true);
					}
				}

				// Increase the timelapse speed one step, if below theshold
				let increaseSpeed = () => {
					if (speed > highestSpeed) {
						speed -= 500;
						timer.stop();
						timer = d3.interval(callback, speed, d3.now());

						if (speed < lowestSpeed) {
							d3.select(".speedButton.slower").attr("disabled", null);
						}
					} else {
						d3.select(".speedButton.faster").attr("disabled", true);
					}
				}

				d3.select("#options")
					.append("button")
					.attr("class", "speedButton slower")
					.text("-")
					.on("click", decreaseSpeed);
				
				d3.select("#options")
					.append("button")
					.attr("class", "speedButton faster")
					.text("+")
					.on("click", increaseSpeed);

				// Keyboard shortcuts for timelapse options
				Mousetrap.bind(['+', '='], increaseSpeed, 'keyup');
				Mousetrap.bind('-', decreaseSpeed, 'keyup');
				Mousetrap.bind('0', togglePlayPause, 'keyup');
			}
		});
});
