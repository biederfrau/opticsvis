function compute(data, state) {
    state.input_data = $.extend(true, [], data);
    state.output_data = optics(data);
}

function filter(state) {

}

// https://bl.ocks.org/mbostock/7f5f22524bd1d824dd53c535eda0187f
function setup_density(state) {
    var canvas = d3.select("#density"),
        style = window.getComputedStyle(document.getElementById("density")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2 + margins.left).attr("y", margins.top / 2)
        .text("Density regions of data set").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2 + margins.left).attr("y", margins.top / 2 + 14).text("Double click to toggle points.")
        .style("font-size", "12px").attr("text-anchor", "middle");

    var x = d3.scaleLinear().range([margins.left, width - margins.right]),
        y = d3.scaleLinear().range([height - margins.bottom, margins.top]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, 0] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_density(state.input_data, state, ctx);
}

function draw_density(data, state, ctx) {
    var canvas = d3.select("#density"),
        color = d3.scaleSequential(d3.interpolateBlues).domain([0, .004]);

    ctx.x.domain(d3.extent(data, x => x[0])).nice();
    ctx.y.domain(d3.extent(data, x => x[1])).nice();

    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    var densityEstimator = d3.contourDensity()
        .x(d => ctx.x(d[0]))
        .y(d => ctx.y(d[1]))
        .size([ctx.width, ctx.height])
		.bandwidth(10);

    canvas.insert("g", "g")
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5)
        .attr("stroke-linejoin", "round")
        .selectAll("path")
        .data(densityEstimator(data))
        .enter().append("path").attr("fill", d => color(d.value))
        .attr("d", d3.geoPath());

    canvas.on("dblclick", () => {
        var points = canvas.selectAll(".point");

        if(points.empty()) {
            points.data(data)
                .enter()
                .append("circle").classed("point", true)
                .attr("cx", d => ctx.x(d[0])).attr("cy", d => ctx.y(d[1]))
                .attr("r", 4)
				.attr("stroke-color", "white")
                .attr("fill", "black");
        } else { points.remove(); }
    });

    state.dispatcher.call("drawn");
}

function setup_reach(state) {
    var canvas = d3.select("#reach"),
        style = window.getComputedStyle(document.getElementById("reach")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2 + margins.left).attr("y", margins.top / 2)
        .text("Reachability distances").style("font-weight", "bold").attr("text-anchor", "middle");

    var x = d3.scaleBand().rangeRound([margins.left, width - margins.right]).padding(0.2);
        y = d3.scaleLinear().range([height - margins.bottom, margins.top]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, 0] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_reach(state.output_data, state, ctx);
}

function draw_reach(data, state, ctx) {
    var canvas = d3.select("#reach");

    // TODO cut off properly
    data = data.filter(x => x.distance < 100);

    ctx.x.domain(data.map((_, i) => i));
    ctx.y.domain(d3.extent(data, d => d.distance)).nice();

    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    var bars = canvas.selectAll(".bar").data(data);

    console.log(ctx.y.range());
    bars.enter().append("rect")
        .attr("x", (d, i) => ctx.x(i))
        .attr("y", d => ctx.y(d.distance) - ctx.margins.bottom)
        .attr("width", ctx.x.bandwidth())
        .attr("height", d => ctx.height - ctx.y(d.distance))
        .attr("fill", "black");

    state.dispatcher.call("drawn");
}

function setup_clusters(state) {

}

function draw_clusters(data, state) {

    state.dispatcher.call("drawn");
}

function setup_jumps(state) {

}

function draw_jumps(data, state) {

    state.dispatcher.call("drawn");
}

function setup_heat(state) {
	var data=state.output_data;
	var datasize=data.length;
	var distances = new Array();
	distances.max=0;
	for(var i=0;i<datasize;++i){
		distances[i]=new Array();
		for(var j=0;j<datasize;++j){
			distances[i][j]=distbetween(data[i],data[j]);
			if(distances[i][j]>distances.max)distances.max=distances[i][j];
		}	
	}
	console.log(distances);
	draw_heat(distances,state);
}

function draw_heat(data, state) {
	var canvas = d3.select("#heat"),
	style = window.getComputedStyle(document.getElementById("heat")),
        margins = {"left": 35, "right": 35, "top": 35, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height),
		color = d3.scalePow()
		.exponent(0.66)
		.domain([0,data.max])
      .interpolate(d3.interpolateHcl)
      .range([d3.rgb("#0000FF"), d3.rgb('#FFFFFF')]);
	var count=data.length;
	var rwidth= (width-margins.left-margins.right)/count;
	var rheight=(height-margins.top-margins.bottom)/count;
	var rects= canvas.selectAll(".rect")
	rects.data(data)
                .enter()
                .append("svg").classed("row", true)
				.attr("x", function(d,i,j) { return margins.left; })
				.attr("y", function(d,i,j) { return height-((i+1) * (rheight))-margins.bottom; })
				.attr("width", width-margins.right)
				.attr("height",rheight)
				.attr("fill", "transparent")
				.selectAll(".row")
				.data( function(d,i,j) { return d; } )
				.enter()
                .append("rect").classed("rect", true)
                .attr("x", function(d,i,j) { return (i * (rwidth)); })
				.attr("y", function(d,i,j) { return 0; })
                .attr("width", rwidth)
				.attr("height",rheight)
                .attr("fill", d=>color(d))
				.attr("stroke","transparent");
				//margins.left+(i * rwidth)
	
    state.dispatcher.call("drawn");
}

function do_the_things() {//{{{
    state = {
        dispatcher: d3.dispatch("drawn", "filter", "date:update", "cat:update", "dist:update", "update"),
        start: performance.now(),
        thinking: function(n = 4) {
            d3.selectAll(".loading").style("display", undefined);

            waiter = n;
            this.dispatcher.on("drawn", _e => {
                waiter -= 1;

                if(waiter == 0) {
                    d3.selectAll(".loading").style("display", "none");
                    console.log("finished waiting at " + _.round(performance.now() - state.start, 2) + "ms");
                }
            });
        },
    };

    // ui crap {{{
    $(".ui-bar .elem").click(function(e) {
        if(!$(".ui-bar").hasClass("toggled")) { $(".ui-bar").addClass("toggled"); }

        if($(this).hasClass("toggled")) {
            var siblings = $(this).siblings(),
                none_toggled = true;

            siblings.each(idx => {
                none_toggled = none_toggled && !$(siblings[idx]).hasClass("toggled");
            });

            console.log(siblings);
            console.log(none_toggled);
            if(none_toggled) { $(".ui-bar").removeClass("toggled"); }
        }

        $(this).toggleClass("toggled");
    });

    $("#about-input").click(e => {
        $(".ui-bar .about-entry").toggleClass("visible");
    });

    $("#data-input").click(e => {
        $(".ui-bar .data-entry").toggleClass("visible");
    });

    $("#data-form").submit(e => {
        state.data = $("#data-textarea").val().split("\n")
            .map(_.trim).filter(line => line !== "")
            .map(x => x.split(" ")).map(x => x.map(parseFloat));

        compute(data, state);
        state.dispatcher.call("update", [state.input_data, state.output_data]);
    }); // }}}

    // state.thinking(5);
    var ssv = d3.dsvFormat(" ");
    d3.request("default.dat")
        .mimeType("text/plain")
        .response(xhr => ssv.parse(xhr.responseText, row => [+row.x, +row.y]))
        .get((err, data) => {
            if(err) { throw err; }

            compute(data, state);

            setup_density(state);
            setup_reach(state);
            setup_clusters(state);
            setup_jumps(state);
            setup_heat(state);
    });
}//}}}
// vim: set ts=4 sw=4 tw=0 et :
