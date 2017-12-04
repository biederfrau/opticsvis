const noisecolor="grey";
const interpolator="Rainbow";
const colorScale = d3.scaleSequential(d3["interpolate" + interpolator]);

const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .text("a simple tooltip");

function compute(data, state) {
    state.input_data = $.extend(true, [], data);
    state.output_data = optics(data);
    state.clustersizes= getClusterSizes();
    colorScale.domain([0, clustersizes.length-1])
}

function filter(state) {

}

// https://bl.ocks.org/mbostock/7f5f22524bd1d824dd53c535eda0187f
// setup_density {{{
function setup_density(state) {
    var canvas = d3.select("#density"),
        style = window.getComputedStyle(document.getElementById("density")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Estimated density regions of data set").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Double click to toggle points.")
        .style("font-size", "12px").attr("text-anchor", "middle");

    var x = d3.scaleLinear().range([margins.left, width - margins.right]),
        y = d3.scaleLinear().range([height - margins.bottom, margins.top]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, 0] + ")");

    canvas.insert("g", "g")
        .classed("contours-bg", true)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5)
        .attr("stroke-linejoin", "round");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_density(state.output_data, state, ctx);

    state.dispatcher.on("data:change.density", data => {
        draw_density(data[1], state, ctx);
    });
} // }}}

// draw_density {{{
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
        .size([ctx.width, ctx.height]);

    var estimated = densityEstimator(data),
        contours = canvas.select(".contours-bg").selectAll(".contour").data(estimated);

    color.domain(d3.extent(estimated, d => d.value));

    contours.enter()
        .append("path").classed("contour", true)
        .merge(contours)
        .attr("fill", d => color(d.value))
        .attr("d", d3.geoPath());

    contours.exit().remove();
    canvas.selectAll(".point").remove();

    canvas.on("dblclick", () => {
        var points = canvas.selectAll(".point");

        if(points.empty()) {
            points.data(data)
                .enter()
                .append("circle").classed("point", true)
                .attr("cx", d => ctx.x(d[0])).attr("cy", d => ctx.y(d[1]))
                .attr("r", 4)
				.attr("stroke-color", "white")
                .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag));
        } else { points.remove(); }
    });

    state.dispatcher.call("drawn");
} // }}}

// draw_reach {{{
function setup_reach(state) {
    var canvas = d3.select("#reach"),
        style = window.getComputedStyle(document.getElementById("reach")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Reachability distances").style("font-weight", "bold").attr("text-anchor", "middle");
//TODO: adjust x tickmarks
    var x = d3.scaleBand().rangeRound([margins.left, width - margins.right]).padding(0.2);
    y = d3.scaleLinear().range([0, height - margins.top -margins.bottom]);

    canvas.append("g").classed("data", true);
    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, ctx.height - ctx.margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [ctx.margins.left, ctx.margins.top] + ")");

    draw_reach(state.output_data, state, ctx);

    state.dispatcher.on("data:change.reach", data => {
        draw_reach(data[1], state, ctx);
});
    var interactioncanvas=canvas.append("g").classed("interaction", true);

    var barbottom=ctx.height-ctx.margins.bottom;
    var max=d3.max(state.output_data, function(d) { return d.distance; });

    var max=d3.max(state.output_data, function(d) { return d.distance; });

    interactioncanvas
        .append("line").classed("cutoff", true)
        .attr("x1",d => ctx.margins.left)
        .attr("y1",d => barbottom-ctx.y(max-cutoff))
        .attr("x2",d => ctx.width-ctx.margins.right)
        .attr("y2",d => barbottom-ctx.y(max-cutoff))
        .attr("stroke-width",3)
        .attr("stroke","black")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    function dragstarted(d) {
        d3.select(this).raise().classed("active", true);
    }

    function dragged(d) {
        //TODO: cleanup
        if(d3.event.y<ctx.margins.top)d3.event.y=ctx.margins.top;
        if(d3.event.y>ctx.height-ctx.margins.bottom)d3.event.y=ctx.height-ctx.margins.bottom;
        d3.select(this).attr("y1", d3.event.y).attr("y2", d3.event.y);
        setcutoff(ctx.y.invert(d3.event.y-ctx.margins.top));
        reCalculateClusters();
        state.clustersizes= getClusterSizes();
        colorScale.domain([0, clustersizes.length-1])
        state.dispatcher.call("size",this,[state.input_data,state.output_data]);
        var rects = d3.select("#reach").select(".data").selectAll(".bar");
        rects.data(state.output_data)
            .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag));
        var points = d3.select("#density").selectAll(".point");
        if(!points.empty()){
        points.data(state.output_data)
            .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag));
        }
        points = d3.select("#jumps").selectAll(".point");
        points.data(state.output_data)
            .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag));

    }
    function dragended(d) {
        d3.select(this).classed("active", false);
    }
} // }}}

// draw_reach {{{
function draw_reach(data, state, ctx) {
    var canvas = d3.select("#reach").select(".data");

    var max=d3.max(data, function(d) { return d.distance; });
    ctx.x.domain(data.map((_, i) => i));
    ctx.y.domain([0,max]);

    var bars = canvas.selectAll(".bar").data(data);
    var barbottom=ctx.height-ctx.margins.bottom;
    bars.enter().append("rect").classed("bar",true).merge(bars)
        .attr("x", (d, i) => ctx.x(i))
        .attr("y", d => barbottom-ctx.y(d.distance))
        .attr("width", ctx.x.bandwidth())
        .attr("height", d => ctx.y(d.distance))
        .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag))
        .on("mouseover", function (d) {
            tooltip.text("Reachability Distance: "+d.distance);
            return tooltip.style("visibility", "visible");
        })
        .on("mousemove", function () {
            return tooltip.style("top",
                (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })
        .on("mouseout", function () {
            return tooltip.style("visibility", "hidden");
        });
    bars.exit().remove();

    ctx.y.domain([max,0])
    canvas=d3.select("#reach");
    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    state.dispatcher.call("drawn");
} // }}}

// setup_clusters {{{
function setup_clusters(state) {
    var canvas = d3.select("#size"),
        style = window.getComputedStyle(document.getElementById("size")),
        margins = {"left": 35, "right": 20, "top": 30, "bottom": 25},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top*2/3)
        .text("Cluster Sizes").style("font-weight", "bold").attr("text-anchor", "middle");

    var x = d3.scaleBand().rangeRound([margins.left, width - margins.right]).padding(0.2);
    y = d3.scaleLinear().range([0, height - margins.top -margins.bottom]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, margins.top] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};

    draw_clusters(state.output_data, state, ctx);

    state.dispatcher.on("data:change.size size", data => {
        draw_clusters(data[1], state, ctx);
});
} // }}}

// draw_clusters {{{
function draw_clusters(data, state, ctx) {
    var axisleftticks=5;
    data=state.clustersizes;
    var canvas = d3.select("#size");

    var max=d3.max(data, function(d) { return d; });
    ctx.x.domain(data.map((_, i) => i));
    ctx.y.domain([0,max]);

    var barbottom=ctx.height-ctx.margins.bottom;
    var bars = canvas.selectAll(".bar").data(data);
    var noiseindex=data.length-1;
    bars.enter().append("rect").classed("bar",true).merge(bars)
        .attr("x", (d, i) => ctx.x(i))
        .attr("y", d => barbottom-ctx.y(d))
        .attr("width", ctx.x.bandwidth())
        .attr("height", d => ctx.y(d))
        .attr("fill", (d,i) => i==noiseindex?noisecolor:colorScale(i))
        .on("mouseover", function (d) {
            tooltip.text("Size: "+d);
            return tooltip.style("visibility", "visible");
        })
        .on("mousemove", function () {
            return tooltip.style("top",
                (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })
        .on("mouseout", function () {
            return tooltip.style("visibility", "hidden");
        });
    bars.exit().remove();

    ctx.y.domain([max,0])
    canvas.select(".xaxis").call(d3.axisBottom(ctx.x).tickFormat(function(d) { return d==data.length-1?"Noise":d}));

    canvas.select(".yaxis").call(d3.axisLeft(ctx.y).ticks(axisleftticks));

    state.dispatcher.call("drawn");
} // }}}

// setup_jumps {{{
function setup_jumps(state) {
    var canvas = d3.select("#jumps"),
        style = window.getComputedStyle(document.getElementById("jumps")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Jump Path").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Placeholder")
        .style("font-size", "12px").attr("text-anchor", "middle");

    var x = d3.scaleLinear().range([margins.left, width - margins.right]),
        y = d3.scaleLinear().range([height - margins.bottom, margins.top]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, 0] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_jumps(state.output_data, state, ctx);
    state.dispatcher.on("data:change.jumps", data => {
        draw_jumps(data[1], state, ctx);});
} // }}}

// draw_jumps {{{
function draw_jumps(data, state,ctx) {
    var canvas = d3.select("#jumps"),
        color = d3.scaleSequential(d3.interpolateBlues).domain([0, .004]);

    ctx.x.domain(d3.extent(data, x => x[0])).nice();
    ctx.y.domain(d3.extent(data, x => x[1])).nice();

    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    var points = canvas.selectAll(".point").data(data);

    points.enter()
        .append("circle").classed("point", true).merge(points)
        .attr("cx", d => ctx.x(d[0])).attr("cy", d => ctx.y(d[1]))
        .attr("r", 4)
        .attr("stroke-color", "white")
        .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag));
    points.exit().remove();

    var jumppaths=canvas.selectAll(".jumppath").data(data);

    jumppaths
        .enter()
        .insert("line", ".point").classed("jumppath", true).merge(jumppaths)
        .attr("x1",d => ctx.x(d[0]))
        .attr("y1",d => ctx.y(d[1]))
        .attr("x2",d => d.from<0?ctx.x(d[0]):ctx.x(data[d.from][0]))
        .attr("y2",d => d.from<0?ctx.y(d[1]):ctx.y(data[d.from][1]))
        .attr("stroke-width",1)
        .attr("stroke","black");

    jumppaths.exit().remove();

    state.dispatcher.call("drawn");
} // }}}

// setup_heat {{{
function setup_heat(state) {
    var closecolor="#000066";
    var distantcolor="#E6F3FF";

	var data=state.output_data;

	var style = window.getComputedStyle(document.getElementById("heat")),
        margins = {"left": 20, "right": 80, "top": 20, "bottom": 20},
        width = parseFloat(style.width),
        height = parseFloat(style.height),
        color = d3.scaleLinear()
        //.scalePow().exponent(0.66)
            .interpolate(d3.interpolateRgb)
            .range([d3.rgb(closecolor), d3.rgb(distantcolor)]);

    var innerheight=height-margins.top-margins.bottom;
    var innerwidth=width-margins.left-margins.right;

    var canvas = d3.select("#heat");

    var heatmapcanvas=canvas.append("g").classed("transfromablemap", true).append("svg")
            .classed("heatmapcanvas", true)
            .attr("x", margins.left)
            .attr("y", margins.top)
            .attr("width", innerwidth)
            .attr("height",innerheight)
        ;

    zoom = d3.zoom()
        .scaleExtent([1, 20])
        .on("zoom", 	function() {
                var e = d3.event;

                e.transform.x = Math.min(0, Math.max(e.transform.x, ctx.width - ctx.width * e.transform.k)),
                    e.transform.y = Math.min(0, Math.max(e.transform.y, ctx.height - ctx.height * e.transform.k));
                /*
                 d3.select(".heatmapcanvas").attr("transform", [
                 "translate(" + [tx, ty] + ")",
                 "scale(" + e.transform.k + ")"
                 ].join(" "));
                 */
                d3.select(".transfromablemap").attr("transform", e.transform);
            }
        );

    canvas.call(zoom);

    var legendwidth=30;
    var disttomap=10;
    var key = canvas.append("svg").attr("width", legendwidth*2).attr("height", height).attr("x",width-margins.right+disttomap).attr("y",0);

    var legend = canvas.append("defs").append("svg:linearGradient").attr("id", "gradient").attr("x1", "100%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%").attr("spreadMethod", "pad");
    legend.append("stop").attr("offset", "0%").attr("stop-color", color.range()[1]);
    legend.append("stop").attr("offset", "100%").attr("stop-color", color.range()[0]);
    key.append("rect").attr("width", legendwidth).attr("height", innerheight).attr("y", margins.top).style("fill", "url(#gradient)");
    var y = d3.scaleLinear().range([ innerheight, 0]);
    key.append("g")
        .attr("class", "yaxis")
        .attr("transform", "translate("+legendwidth+","+margins.top+")");


    var ctx = {"y":y,"margins": margins, "width": width, "height": height, "color":color, "innerheight":innerheight, "innerwidth":innerwidth};
	draw_heat(data,state,ctx);
    state.dispatcher.on("data:change.heat", data => {
        draw_heat(data[1], state,ctx);
    });
} // }}}

// draw_heat {{{
function draw_heat(data, state,ctx) {

	var canvas = d3.select("#heat");

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

    data=distances;
    ctx.y.domain([0,data.max]);
    ctx.color.domain([0,data.max])
	var count=data.length;
	var rheight=ctx.innerheight/count;
	var rwidth= ctx.innerwidth/count;

	var heatmapcanvas=canvas.select(".heatmapcanvas");

    heatmapcanvas.selectAll(".row").remove();
	var rows= heatmapcanvas.selectAll(".row").data(data);

	rows       .enter()
                .append("g").classed("row", true)
                .attr("transform", function(d,i) { return "translate(0,"+(ctx.innerheight-((i+1) * (rheight)))+")"})
                .selectAll(".rect").data( function(d,i,j) { return d; } )
				.enter()
                .append("rect").classed("rect", true)
                .attr("x", function(d,i,j) { return (i * (rwidth)); })
				.attr("y", function(d,i,j) { return 0; })
                .attr("width", rwidth)
				.attr("height",rheight)
                .attr("fill", d=>ctx.color(d))
				.attr("stroke","transparent");
    heatmapcanvas.selectAll(".rect")
                .on("mouseover", function (d) {
                    tooltip.text("Distance: "+d);
                    return tooltip.style("visibility", "visible");
                })
                .on("mousemove", function () {
                    return tooltip.style("top",
                        (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
                })
                .on("mouseout", function () {
                    return tooltip.style("visibility", "hidden");
                });

    canvas.select(".yaxis").call(d3.axisRight(ctx.y));

    state.dispatcher.call("drawn");
} // }}}

function do_the_things() {//{{{
    state = {
        dispatcher: d3.dispatch("drawn", "filter", "data:change", "size"),
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

    $("#settings-input").click(e => {
        $(".ui-bar .settings-entry").toggleClass("visible");
    });

    $("#data-form").submit(e => {
        data = $("#data-textarea").val().split("\n")
            .map(_.trim).filter(line => line !== "")
            .map(x => x.split(" ")).map(x => x.map(parseFloat));

        compute(data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
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
