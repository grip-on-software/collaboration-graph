import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import Network from './Network';

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

				network.startTimelapse(intervalFile(intervals[9]));
			}
		});

	d3.select("#options")
		.append("select")
		.selectAll('option')
		.data(intervals).enter()
		.append("option")
		.text(seconds => {
			let d = new Date(0);
			d.setUTCSeconds(seconds);
			
			return `${d.getFullYear()}-${d.getMonth()}`;
		})
		.on("click", (d) => {
			if (timelapseMode) {
				network.timelapseTick(intervalFile(d));
			}
		});
});
