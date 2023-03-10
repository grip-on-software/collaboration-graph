/**
 * Collaboration graph network layout algorithm.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
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
import moment from 'moment';
import config from 'config.json';

const r = 10;

const color = d3.scaleLinear()
            .domain([1, 2, 3, 4])
    .range(['#1f78b4', '#b2abd2', '#e66101', '#5e3c99']);

const svg = d3.select("svg");
let width = +svg.attr("width");
let height = +svg.attr("height");

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id))
    .force("charge", d3.forceManyBody().strength(node => node.colorIndex > 1 ? -30 : -300))
    .on("tick", ticked);

function resized() {
    width = svg.node().parentNode.clientWidth;
    height = svg.node().parentNode.clientHeight;

    simulation
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX(width / 2).strength(0.05 * height/width))
        .force("y", d3.forceY(height / 2).strength(0.05 * width/height))
        .force("circle", d3.forceRadial(10, width / 2, height / 2).strength(0.05))
        .alphaTarget(0.3)
        .restart();
}

const group = svg.append("g");
let data; // Project members data
let node = null; // Individual node svg elements
let link; // Individual link svg elements
let linkElement; // Link element holder
let nodesElement; // Nodes element holder
let text; // Text labels for the nodes
let g; // Element that holds each node in timelapse view

let nodes = []; // All nodes

/**
 * A force-directed graph layout for a collaboration network.
 */
class Network {
    constructor(locales) {
        this.locales = locales;
        this.totalData = [];
        this.addedLinks = [];
        this.addNodes = [];
        this.removedNodes = null;
        this.findTimeout = null;
        this.allEncrypted = true;
    }

    /**
     * Create or recrease the network diagram.
     */
    create() {
        this.resize();
        axios.get("data/project_members.json").then(response => {
            data = response.data;
            this.makeGraph(response.data);
        });
    }

    /**
     * Resize the diagram.
     */
    resize() {
        resized();
    }

    /**
     * Create the graph and start the layout simulation.
     */
    makeGraph(data) {
        this.addNodesAndLinks(data);
        this.createSimulation(data);
    }

    /**
     * Add nodes and edges to the graph based on network data.
     */
    addNodesAndLinks(data, date) {
        const checkNew = typeof date !== "undefined";

        // Get an array of all project keys
        const projects = d3.group(data, d => d.target);

        // Add all projects as nodes
        projects.forEach((projectData, project) => {
            if (!checkNew || !_.find(nodes, nodeHere => nodeHere.id === project)) {
                nodes.push({
                    "id": project,
                    "colorIndex": projectData[0].support ? 0 : 1
                });
            }
        });

        // Get all person nodes
        const people = d3.group(data, d => d.source);

        people.forEach((item, person) => {
            // Get a list of elements for all projects this person was involved in
            const personData = _.filter(data, d => d.source === person);

            // Determine the node color
            const colorIndex = getPersonColorIndex(personData);

            if (!checkNew || ! _.find(nodes, nodeHere => nodeHere.id === person)) {
                // This person isn't in the data, so add a node
                nodes.push({
                    "id": person,
                    "encryption": personData[0].encryption,
                    "colorIndex": colorIndex
                });
                this.allEncrypted = this.allEncrypted && personData[0].encryption > 0;

                // Track the links of this person for update decay
                if (checkNew) {
                    personData.forEach(d => {
                        d.linkUpdatedAt = date;
                        this.totalData.push(d);
                    });
                }
            } else {
                // This person is already in the data.
                // Check which projects the person is already involved in
                const currentProjects = _.map(_.filter(this.totalData, d => d.source.id === person), d => d.target.id || d.target);

                // Add links for new projects
                personData.forEach(d => {
                    if (!_.find(currentProjects, project => d.target === project)) {
                        d.linkUpdatedAt = date;
                        this.totalData.push(d);
                    }
                });

                // Update the tracking date for the person's links
                // We assume that other data (name) remains the same (data join)
                this.totalData.forEach(d => {
                    if (d.source.id === person) {
                        d.linkUpdatedAt = date;
                    }
                });
            }
        });
    }

    /**
     * Remove nodes and edges based on activity expiry during a timelapse.
     */
    removeOldNodesAndLinks(date) {
        const threeMonthsBefore = moment(date).subtract(3, 'months');

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

                        // Look for other (new) links that are connected to
                        // this node
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
    }

    /**
     * Create the force-directed layout in the diagram.
     */
    createSimulation(data) {
        linkElement = group.append("g")
            .attr("class", "links")
            .selectAll("line");

        link = makeLink(linkElement.data(data).enter());

        nodesElement = group.append("g")
            .attr("class", "nodes");

        node = makeNode(nodesElement.selectAll("circle").data(nodes).enter());
        node.call(setNodeHover);

        node.append("title")
            .text(d => d.id);

        simulation
            .nodes(nodes);
            // .on("tick", this.ticked);

        simulation.force("link")
            .links(data);

        this.updateProperties();
    }

    /**
     * Toggle the display of external user nodes.
     */
    toggleExtern() {
        if (this.removedNodes) {
            this.removedNodes.attr("visibility", "visible");

            this.removedNodes = null;

            this.restart(data, false);

            return false;
        } else {
            this.removedNodes = node.filter(d => d.colorIndex === 3)
                .attr("visibility", "collapse");

            this.restart(data.filter(d => d.internal), false);

            return true;
        }
    }

    /**
     * Build a legend node.
     */
    buildNode(type, colorIndex, hideIfZero=true) {
        return {
            "type": this.locales.attribute("node-types", type),
            "value": node.filter(d => d.colorIndex === colorIndex).size(),
            "hideIfZero": hideIfZero,
            "legend": (parentElement, width, height) => {
                const nodes = parentElement.append("g")
                    .classed("nodes", true).data([{colorIndex}]);
                const node = makeNode(nodes);
                node.attr("transform", `translate(${width/2}, ${height/2})`);
            }
        };
    }

    /**
     * Update legend and statistics.
     */
    updateProperties() {
        const data = [
            this.buildNode("project", 1, false),
            this.buildNode("support-team", 0),
            this.buildNode("developer", 4),
            this.buildNode("external", 3),
            this.buildNode("support-member", 5),
            this.buildNode("other", 2, false),
            {
                "type": this.locales.attribute("node-types", "link"),
                "value": link.size(),
                "legend": (parentElement, width, height) => {
                    const nodes = parentElement.append("g")
                        .classed("links", true).data([{num_commits: 100}]);
                    const link = makeLink(nodes);
                    link.attr("x1", 0)
                        .attr("y1", height / 2)
                        .attr("x2", width)
                        .attr("y2", height / 2);
                }
            }
        ];
        const properties = d3.select("#properties").selectAll("div")
            .data(data, d => d.type);
        properties.exit().remove();

        const row = properties.enter().append("div");
        row.append("svg").classed("legend", true)
            .attr("width", "20").attr("height", "20").each(function(d) {
                if ("legend" in d) {
                    d.legend(d3.select(this), 20, 20);
                }
            });
        row.append("span");
        row.merge(properties)
            .style("display", d => d.hideIfZero && d.value === 0 ? "none" : null)
            .selectAll("span").data(d => [d])
            .text(d => `${d.type}: ${d.value}`);
    }

    /**
     * Restart the force-directed simulation with new data.
     */
    restart(linkData, titles=true) {
        // Apply the general update pattern to the nodes.
        node = node.data(nodes, d => d.id);
        node.exit().remove();

        const newNode = node.enter()
            .append("g")
                .attr("class", "node")
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended));

        newNode.append("circle")
            .append("title").text(d => d.id);
        newNode.append("text");

        node = newNode.merge(node);
        node.select("circle")
            .attr("fill", d => color(d.colorIndex))
            .attr("r", d => getNodeRadius(d))
            .call(setNodeHover);

        node.select("text")
            .text(d => {
                if (titles && d.colorIndex === 1) {
                    return d.id;
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

    /**
     * Zoom the diagram toward a specific node.
     */
    zoom(selectNode) {
        const zoom = d3.zoom().on("zoom", (event) => {
            group.attr("transform", event.transform);
        }).on("end", () => {
            node.attr('fill', d => color(d.colorIndex));
            if (selectNode && !selectNode.empty()) {
                selectNode.attr('fill', 'red');
            }
        });
        const scale = 2;
        let transform = d3.zoomIdentity;
        if (selectNode && !selectNode.empty()) {
            const d = selectNode.data()[0];
            transform = transform
                .translate(-d.x * scale + width / 2, -d.y * scale + height / 2)
                .scale(scale);
        }
        svg.transition().duration(3000)
            .call(zoom.transform, transform);
        return Promise.resolve();
    }

    /**
     * Find a project or person by their common name.
     * If the node associated with the project or person is found,
     * then the diagram zooms into the area of the node.
     */
    find(name) {
        if (name === '') {
            if (this.findTimeout) {
                return Promise.resolve();
            }
            this.findTimeout = setTimeout(function(network) {
                network.findTimeout = null;
            }, 3000, this);
            return this.zoom();
        }

        if (this.findTimeout) {
            clearTimeout(this.findTimeout);
            this.findTimeout = null;
        }

        const projectMatch = node.filter(d => d.colorIndex <= 1 && d.id.toUpperCase() === name.toUpperCase());
        if (!projectMatch.empty()) {
            return this.zoom(projectMatch);
        }
        const lowerWords = _.zipObject(config.lower_names);
        const titleCase = word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
        const displayName = _.map(_.split(name, /([ -])/), word => word in lowerWords ? word : titleCase(word)).join('');
        const match = node.filter(d => d.colorIndex > 1 && d.encryption === 0 && d.id === displayName);
        if (!match.empty()) {
            return this.zoom(match);
        }

        return new Promise((resolve, reject) => {
            this.findTimeout = setTimeout(function (network, displayName) {
                network.findEncrypted(displayName).then(resolve, reject);
                network.findTimeout = null;
            }, 300, this, displayName);
        });
    }

    /**
     * Find the node with encrypted data belonging to a person by comparing
     * the encrypted version of the provided name to it.
     */
    findEncrypted(name) {
        if (!config.encrypt_url) {
            return Promise.reject();
        }
        const url = `${config.encrypt_url}?value=${name}`;
        return axios.get(url).then(response => {
            const data = response.data;
            const match = node.filter(d => d.colorIndex > 1 && d.encryption === data.encryption && d.id === data.value);
            if (!match.empty()) {
                return this.zoom(match);
            }
            return Promise.reject();
        });
    }

    /**
     * Initialize a timelapse by clearing out all nodes and edges.
     */
    startTimelapse() {
        this.totalData = [];

        nodes = [];

        this.restart([]);
    }

    /**
     * End a timelapse by replacing the nodes and edges with the default set
     * and restarting the simulation.
     */
    stopTimelapse() {
        data = _.map(data, d => _.assign(d, {
            source: d.source.id || d.source,
            target: d.target.id || d.target
        }));
        this.totalData = [];

        nodes = [];

        this.addNodesAndLinks(data);
        this.restart(data, false);
    }

    /**
     * Perform an update for a timelapse by loading in new node and edge data.
     */
    timelapseTick(file, date) {
        axios.get(file).then(response => {
            const data = response.data;

            this.addNodesAndLinks(data, date);
            this.removeOldNodesAndLinks(date);

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
        .attr("r", d => getNodeRadius(d))
        .attr("fill", d => color(d.colorIndex))
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
}

function setNodeHover(node) {
    node.on('mouseover', d => {
        // When hovering over a node, highlight all connected lines
        link.style('stroke', l => {
            if (d === l.source || d === l.target) {
                return 'red';
            }

            return '#999';
        });
    });

    // Set the stroke width back to normal when mouse leaves the node.
    node.on('mouseout', () => link.style('stroke', '#999'));
}

function makeLink(parentElement) {
    return parentElement.append("line")
        .attr("stroke-width", d => {
            return Math.floor(Math.min(Math.max(Math.log10(d.num_commits),1), 4));
        });
}

function getPersonColorIndex(personData) {
    // Default color for unclassified "other" people
    let colorIndex = 2;

    if (!personData[0].internal) {
        // External people have a different color
        colorIndex = 3;
    }
    else if (_.transform(personData, (support, item) => !(item.support && item.num_issues > 30 && support.push(item.target)), []).length > 0) {
        // Support team people have a different color
        colorIndex = 5;
    }
    else {
        const commitsForAllProjects = _.reduce(personData, (sum, item) => sum + item.num_commits, 0);

        // If this person has a certain amount of commits, give them a developer color
        if (commitsForAllProjects > 30) {
            colorIndex = 4;
        }
    }

    return colorIndex;
}

function getNodeRadius(d) {
    // Make project nodes larger
    if (d.colorIndex <= 1) {
        return 10;
    }

    return 5;
}

function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

export default Network;
