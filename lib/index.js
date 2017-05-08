import * as d3 from 'd3';

const svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

const color = d3.scaleOrdinal(d3.schemeCategory20);

const simulation = d3.forceSimulation()
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

	let link = svg.append("g")
		.attr("class", "links")
		.selectAll("line")
		.data(data)
		.enter().append("line")
		.attr("stroke-width", function(d) { return Math.sqrt(1); });

	let node = svg.append("g")
		.attr("class", "nodes")
		.selectAll("circle")
		.data(nodes)
		.enter().append("circle")
		.attr("r", d => {
			// Make project nodes larger
			if (d.value === 1) {
				return 7;
			}

			return 5;
		})
		.attr("fill", function(d) { return color(d.value); })
		.on("mouseover", d => console.log(d))
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended));
	
	// When hovering over a node, highlight all connected lines
	node.on('mouseover', (d) => {
		link.style('stroke', function(l) {
			if (d === l.source || d === l.target) {
				return 'red';
			}
			
			return '#999';
		});
	});

	// Set the stroke width back to normal when mouse leaves the node.
	node.on('mouseout', () => link.style('stroke', '#999'));

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
