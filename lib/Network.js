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

let node;
let link;
let links;
let nodesElement;

let nodes = [];

class Network {
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

		links = svg.append("g")
			.attr("class", "links");

		link = links
			.selectAll("line")
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
		let removedLinks = null;

		// Add a button to filter external people out
		d3.select("#options")
		.append("button")
			.text('Extern')
			.on("click", () => {
					if (removedLinks) {
						removedNodes.attr("visibility", "visible");
						removedLinks.attr("visibility", "visible");

						removedNodes = null;
						removedLinks = null;

						this.restart(data);
					} else {
						removedNodes = node.filter(d => d.colorIndex === 3).attr("visibility", "collapse");
						removedLinks = link.filter(d => !d.internal).attr("visibility", "collapse");

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
		simulation
			.nodes(nodes);
		simulation.force("link")
			.links(linkData);
		simulation.alphaTarget(0.3).restart();

		// Stop movement after 2 seconds
		setTimeout(() => simulation.alphaTarget(0), 2000);
	}

	ticked() {
		node
			.attr("cx", d => d.x = Math.max(r, Math.min(width - r, d.x)))
			.attr("cy", d => d.y = Math.max(r, Math.min(height - r, d.y)));

		link
			.attr("x1", d => d.source.x)
			.attr("y1", d => d.source.y)
			.attr("x2", d => d.target.x)
			.attr("y2", d => d.target.y);
	}

	startTimelapse() {
		console.log("timelapse");

		let data = [];

		node.remove(); // filter(d => d.colorIndex !== 1)
		link.remove();

		nodes = [];

		this.restart(data.filter(d => d));	
	}

	timelapseTick(file) {
		console.log(file);
		axios.get(file).then(response => {
			// console.log(response.data);

			let data = response.data;

			// Create project nodes if they don't exist
			const projects = Object.keys(
				d3.nest()
					.key(d => d.target)
					.object(data)
				);

			let item;

			let newNodes = [];			

			for (item in projects) {
				if(! _.find(nodes, nodeHere => nodeHere.id === projects[item])) {
					let newNode = {"id": projects[item], "colorIndex": 1};
					nodes.push(newNode);
					newNodes.push(newNode);
				}
			}

			// Create person nodes if they don't exist, otherwise add these values to the existing node
			const people = Object.keys(
				d3.nest()
					.key(d => d.source)
					.object(data)
				);

			for (item in people) {
				if (! _.find(nodes, nodeHere => nodeHere.id === people[item])) {
					// This determines the node color
					let colorIndex = 2;

					// Returns an element for all projects this person was involved in
					const personData = _.filter(data, d => d.source === people[item]);

					if (! personData[0].internal) {
						// External people have different color
						colorIndex = 3;
					}

					let newNode = {"id": people[item], colorIndex};
					nodes.push(newNode);
					newNodes.push(newNode);
				} else {
					// This person is already in the data, add the new values to the data
				}
			}

			console.log(nodes);

			// Add lines between nodes
			link = links
				.selectAll("line")
				.data(data)
				.enter().append("line")
				.attr("stroke-width", d => {
					return Math.floor(Math.min(Math.max(Math.log10(d.num_commits),1), 4));
				});

			node = nodesElement
				.selectAll("circle")
				.data(newNodes)
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
			
			node.append("title")
				.text(d => d.id);

			// Restart the simulation
			this.restart(data);
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
