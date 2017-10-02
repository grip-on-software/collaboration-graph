import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';

const svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

const r = 10;

const color = d3.scaleLinear()
            .domain([1, 2, 3, 4])
	.range(['#1f78b4', '#b2abd2', '#e66101', '#5e3c99']);

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id))
    .force("charge", d3.forceManyBody().strength(node => node.colorIndex > 1 ? -30 : -300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(width / 2).strength(0.05 * height/width))
    .force("y", d3.forceY(height / 2).strength(0.05 * width/height))
	.on("tick", ticked);

let group = svg.append("g");
let data; // Project members data
let node = null; // Individual node svg elements
let link; // Individual link svg elements
let linkElement; // Link element holder
let nodesElement; // Nodes element holder
let text; // Text labels for the nodes
let g; // Element that holds each node in timelapse view

let nodes = []; // All nodes

class Network {
	constructor() {
		this.totalData = [];
		this.addedLinks = [];
		this.addNodes = [];
        this.removedNodes = null;
        this.findTimeout = null;
	}

	create() {
		axios.get("data/project_members.json").then(response => {
            data = response.data;
			this.makeGraph();
		});
	}

	makeGraph() {
		// Get an array of all project keys
		const projects = d3.nest()
			.key(d => d.target)
			.object(data);

		// Add all projects as nodes
		for (let project in projects) {
			nodes.push({
                "id": project,
                "colorIndex": projects[project][0].support ? 0 : 1
            });
		}

		// Get all person nodes
		const people = Object.keys(
			d3.nest()
				.key(d => d.source)
				.object(data)
			);

		for (let item in people) {
			// This determines the node color
			let colorIndex = 2;

			// Returns an element for all projects this person was involved in
			const personData = _.filter(data, d => d.source === people[item]);

			if (! personData[0].internal) {
				// External people have a different color
				colorIndex = 3;
			}
            else if (_.transform(personData, (support, item) => !(item.support && item.num_issues > 30 && support.push(item.target)), []).length > 0) {
                // Support team people have a different color
                colorIndex = 5;
            }
            else {
				const commitsForAllProjects = _.reduce(personData, (sum, item) => sum += item.num_commits, 0);

				// If this person has a certain amount of commits, give them a developer color
				if (commitsForAllProjects > 30) {
					colorIndex = 4;
				}
			}

			nodes.push({
                "id": people[item],
                "encryption": personData[0].encryption,
                "colorIndex": colorIndex
            });
		}

		linkElement = group.append("g")
			.attr("class", "links")
			.selectAll("line");

		link = makeLink(linkElement.data(data).enter());

		nodesElement = group.append("g")
			.attr("class", "nodes");

		node = makeNode(nodesElement.selectAll("circle").data(nodes).enter());

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

		node.append("title")
			.text(d => d.id);

		simulation
			.nodes(nodes);
			// .on("tick", this.ticked);

		simulation.force("link")
			.links(data);

        this.updateProperties();
	}

    toggleExtern() {
		if (this.removedNodes) {
			this.removedNodes.attr("visibility", "visible");

			this.removedNodes = null;

			this.restart(data);
		} else {
			this.removedNodes = node.filter(d => d.colorIndex === 3)
                .attr("visibility", "collapse");

			this.restart(data.filter(d => d.internal));						
		}
	}

    updateProperties() {
        let buildNode = (type, colorIndex, hideIfZero) => ({
            "type": type,
            "value": node.filter(d => d.colorIndex === colorIndex).size(),
            "hideIfZero": typeof hideIfZero === "undefined" ? true : hideIfZero,
            "legend": (parentElement, width, height) => {
                let nodes = parentElement.append("g")
                    .classed("nodes", true).data([{colorIndex}])
                let node = makeNode(nodes);
                node.attr("transform", `translate(${width/2}, ${height/2})`);
            }
        });

        let data = [
            buildNode("Projects", 1, false),
            buildNode("Support teams", 0),
            buildNode("Developers", 4),
            buildNode("External people", 3),
            buildNode("Support members", 5),
            buildNode("Other people", 2, false),
            {
                "type": "Links",
                "value": link.size(),
                "legend": (parentElement, width, height) => {
                    let nodes = parentElement.append("g")
                        .classed("links", true).data([{num_commits: 100}])
                    let link = makeLink(nodes);
                    link.attr("x1", 0)
                        .attr("y1", height / 2)
                        .attr("x2", width)
                        .attr("y2", height / 2);
                }
            }
        ];
        let properties = d3.select("#properties").selectAll("div")
            .data(data, d => d.type);
        properties.exit().remove();
        
        let row = properties.enter().append("div");
        let svg = row.append("svg").classed("legend", true)
            .attr("width", "20").attr("height", "20").each(function(d) {
                if ("legend" in d) {
                    d["legend"](d3.select(this), 20, 20);
                }
            });
        row.append("span");
        row.merge(properties)
            .style("display", d => d.hideIfZero && d.value === 0 ? "none" : null)
            .selectAll("span").data(d => [d])
            .text(d => `${d.type}: ${d.value}`);
    }

	 restart(linkData) {
		// Apply the general update pattern to the nodes.
		node = node.data(nodes, d => d.id);
		node.exit().remove();
		
		node = node.enter()
			.append("g")
				.attr("class", "node")
				.call(d3.drag()
					.on("start", dragstarted)
					.on("drag", dragged)
					.on("end", dragended))
				.merge(node);
		
		node.append("circle");
		node.append("text");

		node.select("circle")
			.attr("fill", d => color(d.colorIndex))
				.attr("r", d => {
					// Make project nodes larger
					if (d.colorIndex <= 1) {
						return 10;
					}

					return 5;
				})
				.on('mouseover', d => {
					// When hovering over a node, highlight all connected lines
					link.style('stroke', l => {
						if (d === l.source || d === l.target) {
							return 'red';
						}

						return '#999';
					})
				})
				.on('mouseout', () => link.style('stroke', '#999')) // Set the stroke width back to normal when mouse leaves the node.
				.append("title")
					.text(d => d.id);

		node.select("text")
			.text(d => {
				if (d.colorIndex === 1) {
					return d.id
				}

				return null;
			})
			.attr("dy", ".35em");

		// Apply the general update pattern to the links.
		link = link.data(linkData);
		link.exit().remove();
		link = link.enter().append("line").merge(link);

		// Update and restart the simulation.
		simulation.nodes(nodes);
		simulation.force("link").links(linkData);
		simulation.alpha(1).restart();

        this.updateProperties();
	}

    zoom(selectNode) {
        const zoom = d3.zoom().on("zoom", () => {
            group.attr("transform", d3.event.transform);
        }).on("end", () => {
            node.attr('fill', d => color(d.colorIndex));
            if (selectNode && !selectNode.empty()) {
                selectNode.attr('fill', 'red');
            }
        });
        const scale = 2;
        let transform = d3.zoomIdentity;
        if (selectNode && !selectNode.empty()) {
            let d = selectNode.data()[0];
            transform = transform
                .translate(-d.x * scale + width / 2, -d.y * scale + height / 2)
                .scale(scale);
        }
        svg.transition().duration(3000)
            .call(zoom.transform, transform);
    }

    find(name) {
        if (name === '') {
            if (this.findTimeout) {
                return;
            }
            this.findTimeout = setTimeout(function(network) {
                network.findTimeout = null;
            }, 3000, this);
            return this.zoom();
        }

        let projectMatch = node.filter(d => d.colorIndex <= 1 && d.id === name.toUpperCase());
        if (!projectMatch.empty()) {
            return this.zoom(projectMatch);
        }
        const lower_words = _.zipObject(["de", "den", "der", "het", "van"]);
        let title_case = word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
        const display_name = _.map(_.split(name, ' '), word => word in lower_words ? word : title_case(word)).join(' ');
        let match = node.filter(d => d.colorIndex > 1 && d.encryption === 0 && d.id === display_name);
        if (!match.empty()) {
            return this.zoom(match);
        }

        if (this.findTimeout) {
            clearTimeout(this.findTimeout);
        }
        this.findTimeout = setTimeout(function (network, display_name) {
            network.findEncrypted(display_name);
            network.findTimeout = null;
        }, 300, this, display_name);
    }

    findEncrypted(name) {
        let url = `/encrypt/?value=${name}`
        if (location.hostname === "localhost") {
            url = 'http://visualization.gros.example' + url;
        }
        axios.get(url).then(response => {
            let data = response.data;
            let match = node.filter(d => d.colorIndex > 1 && d.encryption === data.encryption && d.id === data.value);
            if (!match.empty()) {
                return this.zoom(match);
            }
        });
    }

	startTimelapse() {
		let data = [];

		node.remove();
		link.remove();

		nodes = [];

		this.restart(data.filter(d => d));	
	}

	timelapseTick(file, date) {
		axios.get(file).then(response => {
			let data = response.data;

			let threeMonthsBefore = moment(date).subtract(3, 'months');			

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

				// Grab the first one to check if this person is internal
				if (! personData[0].internal) {
					// External people have different color
					colorIndex = 3;
				}

				// If this person isn't in the data, add a node
				if (! _.find(nodes, nodeHere => nodeHere.id === people[item])) {
					nodes.push({"id": people[item], colorIndex});
					personData.forEach(d => {
						d.linkUpdatedAt = date;
						this.totalData.push(d);
					});
				} else {
					// This person is already in the data

                    let currentProjects = _.map(_.filter(this.totalData, d => d.source.id === people[item]), d => d.target.id || d.target);

					// Add a link if it is a new project
					personData.forEach(d => {
                        if (!_.find(currentProjects, project => d.target === project)) {
							d.linkUpdatedAt = date;
							this.totalData.push(d);
						}
					});

					// Update the updatedAt for the current link
					this.totalData.forEach(d => {
						if (d.source.id === people[item]) {
							d.linkUpdatedAt = date;
							// TODO add the updated data to this link
						}
					});
				}
			}

			// Remove old links and nodes
			this.totalData.forEach(d => {
				// If a link is 3 months old, remove it from the link data
				if (d.linkUpdatedAt.isSameOrBefore(threeMonthsBefore)) {
					_.remove(this.totalData, dt => dt === d);

					// If the connected node has no links, remove it
					nodes.forEach(n => {
						// If this is the node in question:
						if (n.id === d.source.id || n.id === d.target.id) {
							let hasOtherLinks = false;

							// Look for other (new) links that are connected to this node
							this.totalData.forEach(l => {
								if (n.id === l.source.id || n.id === l.target.id || n.id === l.source || n.id === l.target) {
									hasOtherLinks = true;
								}
							});

							// If there are no other links, delete the node
							if (! hasOtherLinks) {
								_.remove(nodes, dd => dd.id === n.id);
							}
						}
					});
				}
			});
			
			// Restart the simulation
			this.restart(this.totalData);
		});
	}
}

function ticked() {
    if (!node) {
        return;
    }
	node.attr("transform", d => {
		// Confine the simulation to the svg bounds
		d.x = Math.max(r, Math.min(width - r, d.x));
		d.y = Math.max(r, Math.min(height - r, d.y));

		return `translate(${d.x},${d.y})`;
	});

	link.attr("x1", d => d.source.x)
		.attr("y1", d => d.source.y)
		.attr("x2", d => d.target.x)
		.attr("y2", d => d.target.y);
}

function makeNode(parentElement) {
    return parentElement.append("circle")
		.attr("r", d => {
			// Make project nodes larger
			if (d.colorIndex <= 1) {
				return 10;
			}

			return 5;
		})
		.attr("fill", d => color(d.colorIndex))
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended));
}

function makeLink(parentElement) {
    return parentElement.append("line")
		.attr("stroke-width", d => {
			return Math.floor(Math.min(Math.max(Math.log10(d.num_commits),1), 4));
		});
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
