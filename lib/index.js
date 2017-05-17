import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';
import Network from './Network';

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

				// This callback will be invoked for each timer tick
				let callback = () => {
					if (index < intervals.length) {
						let d = new Date(0);
						d.setUTCSeconds(intervals[index]);

						h3.text(moment(d).format('MMMM YYYY'))

						network.timelapseTick(intervalFile(intervals[index]));

						index++;
					}

					if (paused) {
						timer.stop();
					}
				};

				// Start the timelapse
				let timer = d3.interval(callback, 1500, d3.now());

				// Add a play/pause button to the timelapse
				d3.select("#options")
					.append("button")
					.attr("id", "pauseButton")
					.text("❚❚")
					.on("click", () => {
						if (paused) {
							paused = false;
							timer = d3.interval(callback, 1500, d3.now());
							d3.select("#pauseButton").text('❚❚');							
						} else {
							paused = true;
							d3.select("#pauseButton").text('►');							
						}
					});
			}
		});
});
