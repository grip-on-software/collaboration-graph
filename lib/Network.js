import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';

const svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

const r = 6;

const color = d3.scaleLinear()
            .domain([1, 2, 3, 4])
            .range(['#1f77b4', '#aec7e8', '#ff7f0e', 'green']);

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(width / 2, height / 2));

let node; // The individual node svg elements
let link; // The individual link svg elements
let linkElement; // The link element holder
let nodesElement; // The nodes element holder

let nodes = []; // All nodes

class Network {
	constructor() {
		this.totalData = [];
	}

	create() {
		axios.get("data/project_members.json").then(response => {
			this.makeGraph(response.data);
		});
	}

	makeGraph(data) {
		// Get an array of all project keys
		const projects = Object.keys(
			d3.nest()
				.key(d => d.target)
				.object(data)
			);

		let item;

		// Add all projects as nodes
		for (item in projects) {
			nodes.push({"id": projects[item], "colorIndex": 1});
		}

		// Get all person nodes
		const people = Object.keys(
			d3.nest()
				.key(d => d.source)
				.object(data)
			);

		for (item in people) {
			// This determines the node color
			let colorIndex = 2;

			// Returns an element for all projects this person was involved in
			const personData = _.filter(data, d => d.source === people[item]);

			if (! personData[0].internal) {
				// External people have different color
				colorIndex = 3;
			} else {
				const commitsForAllProjects = _.reduce(personData, (sum, item) => sum += item.num_commits, 0);

				// If this person has a certain amount of commits, give them a developer color
				if (commitsForAllProjects > 30) {
					colorIndex = 4;
				}
			}

			nodes.push({"id": people[item], colorIndex});
		}

		linkElement = svg.append("g")
			.attr("class", "links")
			.selectAll("line");

		link = linkElement
			.data(data)
			.enter().append("line")
			.attr("stroke-width", d => {
				return Math.floor(Math.min(Math.max(Math.log10(d.num_commits),1), 4));
			});

		nodesElement = svg.append("g")
			.attr("class", "nodes");

		node = nodesElement
			.selectAll("circle")
			.data(nodes)
			.enter().append("circle")
			.attr("r", d => {
				// Make project nodes larger
				if (d.colorIndex === 1) {
					return 10;
				}

				return 5;
			})
			.attr("fill", d => color(d.colorIndex))
			.call(d3.drag()
				.on("start", dragstarted)
				.on("drag", dragged)
				.on("end", dragended));

		// When hovering over a node, highlight all connected lines
		node.on('mouseover', d => {
			link.style('stroke', l => {
				if (d === l.source || d === l.target) {
					return 'red';
				}
				
				return '#999';
			});
		});

		// Set the stroke width back to normal when mouse leaves the node.
		node.on('mouseout', () => link.style('stroke', '#999'));

		let removedNodes = null;

		// Add a button to filter external people out
		this.externButton = d3.select("#options")
		.append("button")
			.text('Extern')
			.on("click", () => {
				if (removedNodes) {
					removedNodes.attr("visibility", "visible");

					removedNodes = null;

					this.restart(data);
				} else {
					removedNodes = node.filter(d => d.colorIndex === 3).attr("visibility", "collapse");

					this.restart(data.filter(d => d.internal));						
				}
			});

		node.append("title")
			.text(d => d.id);

		simulation
			.nodes(nodes)
			.on("tick", this.ticked);

		simulation.force("link")
			.links(data);
	}

	 restart(linkData) {
		// Apply the general update pattern to the nodes.
		node = node.data(nodes, d => d.id);
		node.exit().remove();
		node = node.enter()
			.append("circle")
			.attr("fill", d => color(d.colorIndex))
			.attr("r", d => {
				// Make project nodes larger
				if (d.colorIndex === 1) {
					return 10;
				}

				return 5;
			})
			.merge(node);

		node.call(d3.drag()
				.on("start", dragstarted)
				.on("drag", dragged)
				.on("end", dragended));
		
		node.append("title")
			.text(d => d.id);

		// When hovering over a node, highlight all connected lines
		node.on('mouseover', d => {
			link.style('stroke', l => {
				if (d === l.source || d === l.target) {
					return 'red';
				}
				
				return '#999';
			});
		});

		// Set the stroke width back to normal when mouse leaves the node.
		node.on('mouseout', () => link.style('stroke', '#999'));

		// Apply the general update pattern to the links.
		link = link.data(linkData);
		link.exit().remove();
		link = link.enter().append("line").merge(link);

		// Update and restart the simulation.
		simulation.nodes(nodes);
		simulation.force("link").links(linkData);
		simulation.alpha(1).restart();
	}

	ticked() {
		node.attr("cx", d => d.x = Math.max(r, Math.min(width - r, d.x)))
			.attr("cy", d => d.y = Math.max(r, Math.min(height - r, d.y)));

		link.attr("x1", d => d.source.x)
			.attr("y1", d => d.source.y)
			.attr("x2", d => d.target.x)
			.attr("y2", d => d.target.y);
	}

	startTimelapse() {
		this.externButton.attr('disabled', true)

		let data = [];

		node.remove();
		link.remove();

		nodes = [];

		this.restart(data.filter(d => d));	
	}

	timelapseTick(file) {
		axios.get(file).then(response => {
			let data = response.data;

			// Create project nodes if they don't exist
			const projects = Object.keys(
				d3.nest()
					.key(d => d.target)
					.object(data)
				);

			let item;

			// Add a node for this project if there isn't currently any
			for (item in projects) {
				if(! _.find(nodes, nodeHere => nodeHere.id === projects[item])) {
					nodes.push({"id": projects[item], "colorIndex": 1});
				}
			}

			// Create person nodes if they don't exist, otherwise add these values to the existing node
			const people = Object.keys(
				d3.nest()
					.key(d => d.source)
					.object(data)
				);

			for (item in people) {
				// Get the item for this person
				const personData = _.filter(data, d => d.source === people[item]);

				// This determines the node color
				let colorIndex = 2;

				// Grab the first one
				if (! personData[0].internal) {
					// External people have different color
					colorIndex = 3;
				}

				if (! _.find(nodes, nodeHere => nodeHere.id === people[item])) {
					nodes.push({"id": people[item], colorIndex});
					this.totalData.push(personData[0]);
				} else {
					// This person is already in the data
					// Find the projects this user is currently involved in
					let currentProjects = _.map(_.filter(this.totalData, d => d.source.id === people[item]), d => d.target.id);

					// Check if this data item is for a new project
					let isNew = true;
					currentProjects.forEach(d => {
						if (d === personData[0].target) {
							isNew = false;
						}
					});

					// Add a link if it is a new project
					if (isNew) {
						this.totalData.push(personData[0]);
					}

					// TODO otherwise, add the data (commits/issues) to the existing link
				}
			}

			// Restart the simulation
			this.restart(this.totalData);
		});
	}
}

function dragstarted(d) {
	if (!d3.event.active) simulation.alphaTarget(0.3).restart();
	d.fx = d.x;
	d.fy = d.y;
}

function dragged(d) {
	d.fx = d3.event.x;
	d.fy = d3.event.y;
}

function dragended(d) {
	if (!d3.event.active) simulation.alphaTarget(0);
	d.fx = null;
	d.fy = null;
}

export default Network;
