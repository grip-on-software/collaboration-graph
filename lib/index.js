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

				network.startTimelapse(intervalFile(intervals[9]));

				let h3 = d3.select('#options')
					.append('h3');

				let index = 0;

				d3.interval(() => {
					if (index < intervals.length) {
						let d = new Date(0);
						d.setUTCSeconds(intervals[index]);

						h3.text(moment(d).format('MMMM YYYY'))

						network.timelapseTick(intervalFile(intervals[index]));

						index++;
					}
				}, 1000, d3.now());
			}
		});
});
