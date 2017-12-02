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
	draw_heat(distances,state);
}

function draw_heat(data, state) {
	var closecolor="#000066";
	var distantcolor="#E6F3FF";
	var canvas = d3.select("#heat"),
	style = window.getComputedStyle(document.getElementById("heat")),
        margins = {"left": 35, "right": 90, "top": 35, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height),
		color = d3.scaleLinear()
		//.scalePow().exponent(0.66)
		.domain([0,data.max])
      .interpolate(d3.interpolateRgb)
      .range([d3.rgb(closecolor), d3.rgb(distantcolor)]);
	  
	 
	  
	  
	var innerheight=height-margins.top-margins.bottom;
	var innerwidth=width-margins.left-margins.right;
	var count=data.length;
	var rheight=innerheight/count;
	var rwidth= innerwidth/count;
	
	var heatmapcanvas=canvas.append("svg")
	.classed("heatmapcanvas", true)
	.attr("x", margins.left)
	.attr("y", margins.top)
	.attr("width", innerwidth)
	.attr("height",innerheight)
	;
	var rects= heatmapcanvas.selectAll(".rect")
	rects.data(data)
                .enter()
                .append("svg").classed("row", true)
				.attr("x", function(d,i,j) { return 0; })
				.attr("y", function(d,i,j) { return innerheight-((i+1) * (rheight)); })
				.attr("width", innerwidth)
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
	
	
	

	
	zoom = d3.zoom()
        .scaleExtent([1, 20])
        .on("zoom", 	function() {
          var e = d3.event;
		  
         e.transform.x = Math.min(0, Math.max(e.transform.x, width - width * e.transform.k)),
         e.transform.y = Math.min(0, Math.max(e.transform.y, height - height * e.transform.k));
/*
          d3.select(".heatmapcanvas").attr("transform", [
            "translate(" + [tx, ty] + ")",
            "scale(" + e.transform.k + ")"
          ].join(" "));	
 */
        d3.select(".heatmapcanvas").attr("transform", e.transform);
    }
	);
			
	canvas.call(zoom);
	
	var legendwidth=30;
	var disttomap=10;
	var key = canvas.append("svg").attr("width", legendwidth*2).attr("height", height).attr("x",width-margins.right+disttomap).attr("y",0);
	
	 var legend = canvas.append("defs").append("svg:linearGradient").attr("id", "gradient").attr("x1", "100%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%").attr("spreadMethod", "pad");
			legend.append("stop").attr("offset", "0%").attr("stop-color", distantcolor);
			legend.append("stop").attr("offset", "100%").attr("stop-color", closecolor);
			key.append("rect").attr("width", legendwidth).attr("height", innerheight).attr("y", margins.top).style("fill", "url(#gradient)");
			var y = d3.scaleLinear().range([ innerheight, 0]).domain([0,data.max]);
			var yAxis = d3.axisRight(y);
			key.append("g").attr("class", "y axis").attr("transform", "translate("+legendwidth+","+margins.top+")")
			.call(yAxis);
	
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