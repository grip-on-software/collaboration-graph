import * as d3 from 'd3';

var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

var color = d3.scaleOrdinal(d3.schemeCategory20);

var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(width / 2, height / 2));

d3.json("data/project_members.json", function(error, data) {
	if (error) throw error;

	const projects = Object.keys(
    	  d3.nest()
        	.key(d => d.target)
        	.object(data)
		);

	let item;
	let nodes = [];

	for (item in projects) {
		nodes.push({"id": projects[item], "value": 1});
	}

	const people = Object.keys(
    	  d3.nest()
        	.key(d => d.source)
        	.object(data)
    	);
	
	for (item in people) {
		nodes.push({"id": people[item], "value": 2});
	}

	var link = svg.append("g")
		.attr("class", "links")
		.selectAll("line")
		.data(data)
		.enter().append("line")
		.attr("stroke-width", function(d) { return Math.sqrt(1); });

	var node = svg.append("g")
		.attr("class", "nodes")
		.selectAll("circle")
		.data(nodes)
		.enter().append("circle")
		.attr("r", 5)
		.attr("fill", function(d) { return color(d.value); })
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended));

	node.append("title")
		.text(function(d) { return d.id; });

	simulation
		.nodes(nodes)
		.on("tick", ticked);

	simulation.force("link")
		.links(data);

	function ticked() {
		link
			.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });

		node
			.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) { return d.y; });
	}
});

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
