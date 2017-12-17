const noisecolor="grey";
const interpolator="Rainbow";
const colorScale = d3.scaleSequential(d3["interpolate" + interpolator]);

const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .text("a simple tooltip")
    .style("pointer-events", "none");

function compute(data, state) {
    state.input_data = $.extend(true, [], data);
    state.output_data = optics(data);
    state.clustersizes= getClusterSizes(state.output_data);
    colorScale.domain([0, state.clustersizes.length-1])
}

function getClusterSizes(data){
    return d3.nest().key(function (d) {
        return d.tag;
    })
        .rollup(function (d) {
            return d3.sum(d, function (g) {
                return 1;
            });
        }).entries(data);
}

function filter(state) {
    var data = state.output_data.filter(x => state.selected_clusters.length === 0 || _.includes(state.selected_clusters, x.tag));
    state.dispatcher.call("filter", this, data);
}

// generate_hierarchy {{{
function generate_hierarchy(data) {
    var distances = _.uniq(data.map(d => d.distance).sort((a, b) => b - a)),
        clusterings = [],
        old_cutoff1 = cutoff1,
        old_cutoff2 = cutoff2;

    // gather different clusterings
    distances.forEach(dist => {
        setcutoff(dist);
        reCalculateClusters();

        var clustering = data.map(d => d.tag),
            diff = _.difference(clustering, _.last(clusterings));

        clustering.dist = dist;
        if(diff.length !== 0 && !_.isEqual(diff, [-1])) {
            clusterings.push(clustering);
        }

        // if(!_.isEqual(clustering, _.last(clusterings))) {
            // clusterings.push(clustering)
        // }
    });

    // only take the first 10 levels as dendrogram gets too large otherwise
    clusterings = _.take(clusterings, 10);

    var edges = [];
    _.range(0, data.length).forEach(i => {
        var str = "";
        _.range(0, clusterings.length).forEach(j => {
            if(clusterings[j][i] === -1) { return; }
            str += (str === '' ? '' : '.') + clusterings[j][i];

            edges.push(str);
        });
    });

    var aggregated_edges = edges.reduce((acc, edge) => {
        var level = +_.sumBy(edge, c => c === '.'),
            total_at_this_level = _.max(clusterings[level]) + 1;

        if(!acc[edge]) { acc[edge] = [level, 0, total_at_this_level, clusterings[level].dist]; }
        acc[edge][1] += 1;

        return acc;
    }, {});

    setcutoffs(old_cutoff1, old_cutoff2);
    reCalculateClusters();

    return _.toPairs(aggregated_edges).map(a => {
        return { id: a[0], level: a[1][0], count: a[1][1], total: a[1][2], dist: a[1][3] };
    });
} // }}}

// https://bl.ocks.org/mbostock/7f5f22524bd1d824dd53c535eda0187f <- density estimation
// https://bl.ocks.org/skokenes/a85800be6d89c76c1ca98493ae777572 <- lassoing
// setup_density {{{
function setup_density(state) {
    var canvas = d3.select("#density"),
        style = window.getComputedStyle(document.getElementById("density")),
        margins = {"left": 55, "right": 100, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Estimated density regions of data set").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Double click to toggle points. Drag to select points.")
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

    canvas.selectAll("text").raise();

    canvas.append("g")
        .classed("legend", true)
        .attr("transform", "translate(" + [width - 70, margins.top] + ")");

    canvas.on("dblclick", () => {
        var points = canvas.selectAll(".point");
        points.style("display", points.style("display") == "none" ? null : "none");
    });

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_density(state.output_data, state, ctx);

    state.dispatcher.on("data:change.density", data => {
        draw_density(data[1], state, ctx);
    });

    state.dispatcher.on("hover:bar.density", row => {
        var points = canvas.selectAll(".point"),
            length_1_x = (x(x.domain()[1]) - x(x.domain()[0])) / (x.domain()[1] - x.domain()[0]),
            length_1_y = (y(y.domain()[0]) - y(y.domain()[1])) / (y.domain()[1] - y.domain()[0]);

        if(row === null || canvas.selectAll(".point").style("display") === "none") {
            canvas.select(".eps-neighborhood").remove();
            points.classed("framed", false);
            return;
        }

        points.filter(d => d === row).classed("framed", true);

        canvas.insert("ellipse", "circle")
            .classed("eps-neighborhood", true)
            .attr("cx", ctx.x(row[0]))
            .attr("cy", ctx.y(row[1]))
            .attr("rx", eps * length_1_x)
            .attr("ry", eps * length_1_y)
            .attr("fill", "grey")
            .style("pointer-events", "none")
            .style("opacity", 0.15)
            .style("stroke", "black")
            .style("stroke-width", 2);
    });

    state.dispatcher.on("detail:bandwidth.density", data => {
        draw_density(state.output_data, state, ctx);
    });

} // }}}

// draw_density {{{
function draw_density(data, state, ctx) {
    var canvas = d3.select("#density"),
        color = d3.scaleSequential(d3.interpolateYlGnBu);

    ctx.x.domain(d3.extent(data, x => x[0])).nice();
    ctx.y.domain(d3.extent(data, x => x[1])).nice();

    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    var densityEstimator = d3.contourDensity()
        .x(d => ctx.x(d[0]))
        .y(d => ctx.y(d[1]))
        .size([ctx.width, ctx.height])
        .bandwidth(state.density_map_bandwidth);

    var estimated = densityEstimator(data),
        contours = canvas.select(".contours-bg").selectAll(".contour").data(estimated);

    color.domain(d3.extent(estimated, d => d.value));

    contours.enter()
        .append("path").classed("contour", true)
        .merge(contours)
        .attr("fill", d => color(d.value))
        .attr("d", d3.geoPath());

    contours.exit().remove();

    var points = canvas.selectAll(".point").data(data);

    points.enter()
        .append("circle").classed("point", true)
        .merge(points)
        .attr("cx", d => ctx.x(d[0])).attr("cy", d => ctx.y(d[1]))
        .attr("r", 4)
        .attr("stroke-color", "white")
        .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag))
        .style("display", "none")
        .on("mouseenter", d => {
            state.dispatcher.call("hover:point", this, d);
        }).on("mouseleave", d => {
            state.dispatcher.call("hover:point", this, [null, null]);
        });

    points.exit().remove();

    var legend = d3.legendColor()
        .shapeWidth(15)
        .shapeHeight(15)
        .cells(5)
        .labels(["low", "", "mid", "", "high"])
        .orient("vertical")
        .ascending(true)
        .scale(color);

    canvas.select(".legend").call(legend);

    var lasso = d3.lasso()
        .closePathSelect(true)
        .closePathDistance(100)
        .items(canvas.selectAll(".point"))
        .targetArea(canvas)
        .on("end", () => {
            lasso.selectedItems().attr("r", 8);
            lasso.notSelectedItems().attr("r", 4);

            state.dispatcher.call("select:points", this, lasso.selectedItems().data());
        });

    canvas.call(lasso);

    state.dispatcher.call("drawn");
} // }}}

// setup_reach {{{
var scutoff1;
var scutoff2;
function setup_reach(state) {
    var canvas = d3.select("#reach"),
        style = window.getComputedStyle(document.getElementById("reach")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Reachability distances").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Double click to show a (partial) dendrogram instead.")
        .style("font-size", "12px").attr("text-anchor", "middle");

    canvas.on("dblclick", () => {
        state.dispatcher.call("toggle:dendrogram");
        $(".dendrogram-overlay").show()
    });

//TODO: adjust x tickmarks
    var x = d3.scaleBand().range([margins.left, width - margins.right]).padding(0.2);
    y = d3.scaleLinear().range([0, height - margins.top -margins.bottom]);

    canvas.append("g").classed("data", true);
    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, ctx.height - ctx.margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [ctx.margins.left, ctx.margins.top] + ")");

    var interactioncanvas=canvas.append("g").classed("interaction", true);
    var moveable2=interactioncanvas.append("g").classed("moveable2",true);
    var moveable1=interactioncanvas.append("g").classed("moveable1",true);

    const rectwidth=12;

    moveable2
        .append("line").classed("cutoff", true)
        .attr("x1",d => 0)
        .attr("y1",d => 0)
        .attr("x2",d => ctx.width-ctx.margins.right-ctx.margins.left+rectwidth)
        .attr("y2",d => 0)
        .attr("stroke-width",1)
        .attr("stroke","gray");

    moveable2.append("rect").classed("cutoffhandle", true)
        .attr("x",d => ctx.width-ctx.margins.right-ctx.margins.left+rectwidth)
        .attr("y",d => -rectwidth/2)
        .attr("height",d => rectwidth)
        .attr("width",d => rectwidth)
        .attr("fill","grey");

    moveable2.call(d3.drag()
        .on("drag", dragged2));


    moveable1
        .append("line").classed("cutoff", true)
        .attr("x1",d => 0)
        .attr("y1",d => 0)
        .attr("x2",d => ctx.width-ctx.margins.right-ctx.margins.left)
        .attr("y2",d => 0)
        .attr("stroke-width",1)
        .attr("stroke","black");

    moveable1.append("rect").classed("cutoffhandle", true)
        .attr("x",d => ctx.width-ctx.margins.right-ctx.margins.left)
        .attr("y",d => -rectwidth/2)
        .attr("height",d => rectwidth)
        .attr("width",d => rectwidth)
        .attr("fill", "black");

    draw_reach(state.output_data, state, ctx);

    state.dispatcher.on("data:change.reach", data => {
        draw_reach(data[1], state, ctx);
    });

    var lassoed = false;
    state.dispatcher.on("select:points.reach", points => {
        console.log("lassoed", lassoed)
        console.log("points", points.length)
        var bars = canvas.selectAll(".bar");
        bars.classed("highlighted-lasso", false);
        if(lassoed && points.length == 0) { lassoed = false; bars.classed("not-highlighted-lasso", false); return; }

        if(points.length !== 0) {
            bars.classed("not-highlighted-lasso", true);
            lassoed = true;
        }

        bars.filter(d => _.find(points, x => x[0] == d[0] && x[1] == d[1])).classed("not-highlighted-lasso", false).classed("highlighted-lasso", true);
    });

    state.dispatcher.on("select:range.reach", range => {
        var bars = canvas.selectAll(".bar");
        bars.classed("highlighted-range", false);
        if(range === null) { bars.classed("not-highlighted-range", false); return; }

        bars.classed("not-highlighted-range", true);
        bars.filter((d, i) => range[0] <= i && i < range[1]).classed("not-highlighted-range", false).classed("highlighted-range", true);
    });

    state.dispatcher.on("filter.reach", data => {
        if(state.selected_clusters.length === 0) {
            canvas.selectAll(".cutoffhandle").style("cursor", undefined);
        } else {
            canvas.selectAll(".cutoffhandle").style("cursor", "not-allowed");
        }

        draw_reach(data, state, ctx);
    });

    state.dispatcher.on("hover:point.reach", p => {
        var bars = canvas.selectAll(".bar");
        bars.classed("framed", false);
        bars.style("opacity", null);

        var framed_bars = bars.filter(d => d[0] == p[0] && d[1] == p[1]).classed("framed", true);

        if(!framed_bars.empty()) canvas.selectAll(".bar:not(.framed).not-highlighted").style("opacity", 0.3)
    });

    moveable1.call(d3.drag()
        .on("drag", dragged));

    function dragged(d) {
        if(state.selected_clusters.length !== 0) { return; }
        if(d3.event.y<ctx.margins.top)d3.event.y=ctx.margins.top;
        if(d3.event.y>ctx.height-ctx.margins.bottom)d3.event.y=ctx.height-ctx.margins.bottom;
        if(d3.event.y>scutoff2){
            moveable2.attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
            scutoff2=d3.event.y;
        }
        d3.select(this).attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
        scutoff1=d3.event.y;
        setcutoffs(ctx.y.invert(scutoff1-ctx.margins.top),ctx.y.invert(scutoff2-ctx.margins.top));
        cutoffchanged(state);
    }

    function dragged2(d) {
        if(state.selected_clusters.length !== 0) { return; }
        if(d3.event.y<ctx.margins.top)d3.event.y=ctx.margins.top;
        if(d3.event.y>ctx.height-ctx.margins.bottom)d3.event.y=ctx.height-ctx.margins.bottom;
        if(d3.event.y<scutoff1){
            moveable1.attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
            scutoff1=d3.event.y;
        }
        d3.select(this).attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
        scutoff2=d3.event.y;
        setcutoffs(ctx.y.invert(scutoff1-ctx.margins.top),ctx.y.invert(scutoff2-ctx.margins.top));
        cutoffchanged(state);
    }
} // }}}

function cutoffchanged(state){
    reCalculateClusters();
    state.clustersizes= getClusterSizes(state.output_data);
    colorScale.domain([0, state.clustersizes.length === 1 ? 1 : state.clustersizes.length-1]);

    state.dispatcher.call("size",this,[state.input_data,state.output_data]);

    // dirty hack to avoid transition when filtering, only show when dragging and not constantly
    // retrigger (as cutoffchanged is constantly called while dragging)
    d3.selectAll(".bar").style("transition", "fill 500ms").transition().duration(500).on("end", () => {
        d3.selectAll(".bar").style("transition", undefined);
    });

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
            state.dispatcher.call("hover:bar", this, d);
            tooltip.text("Reachability Distance: "+_.round(d.distance, 2));
            return tooltip.style("visibility", "visible");
        })
        .on("mousemove", function () {
            return tooltip.style("top",
                (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })
        .on("mouseout", function () {
            state.dispatcher.call("hover:bar", this, null);
            return tooltip.style("visibility", "hidden");
        });
    bars.exit().remove();

    ctx.y.domain([max,0])
    canvas=d3.select("#reach");
    canvas.select(".xaxis").call(d3.axisBottom(ctx.x).tickFormat(""));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    scutoff1=barbottom-ctx.y(max-getcutoff1());
    scutoff2=barbottom-ctx.y(max-getcutoff2());

    d3.select(".moveable2").attr("transform", "translate(" + [ctx.margins.left, scutoff2] + ")")
    d3.select(".moveable1").attr("transform", "translate(" + [ctx.margins.left, scutoff1] + ")")

    state.dispatcher.on("select:level.reach", () => {
        scutoff1=barbottom-ctx.y(max-getcutoff1());
        scutoff2=barbottom-ctx.y(max-getcutoff2());
        d3.select(".moveable1").attr("transform", "translate(" + [ctx.margins.left, scutoff1] + ")")
        d3.select(".moveable2").attr("transform", "translate(" + [ctx.margins.left, scutoff2] + ")")
    });

    state.dispatcher.call("drawn");
} // }}}

// setup_clusters {{{
function setup_clusters(state) {
    var canvas = d3.select("#size"),
        style = window.getComputedStyle(document.getElementById("size")),
        margins = {"left": 35, "right": 20, "top": 40, "bottom": 25},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top/2)
        .text("Cluster Sizes").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2 + 14)
        .text("Select to filter by cluster(s). Double click to clear filter.").style("font-size", "12px").attr("text-anchor", "middle");

    var x = d3.scaleBand().rangeRound([margins.left, width - margins.right]).padding(0.2),
        y = d3.scaleLinear().range([0, height - margins.top -margins.bottom]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, margins.top] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};

    canvas.on("dblclick", () => {
        canvas.selectAll(".bar").style("opacity", undefined);
        state.selected_clusters = [];
        filter(state);
    });

    draw_clusters(state.clustersizes, state, ctx);

    state.dispatcher.on("data:change.size size", data => {
        draw_clusters(state.clustersizes, state, ctx);
    });
} // }}}

// draw_clusters {{{
function draw_clusters(data, state, ctx) {
    data.sort(d => +d.key === -1 ? 1 : 0); // keep noise at last index
    var axisleftticks=5;
    var canvas = d3.select("#size");

    var max=d3.max(data, function(d) { return d.value; });
    ctx.x.domain(data.map((_, i) => i));
    ctx.y.domain([0,max]);

    var subclustersize_per_cluster = state.output_data.reduce((acc, x) => {
        if(!acc[x.tag]) { acc[x.tag] = {}; }
        if(!acc[x.tag][x.subtag]) { acc[x.tag][x.subtag] = 0; }
        acc[x.tag][x.subtag] += 1;

        return acc;
    }, {});

    canvas.selectAll(".separator").remove();

    var barbottom=ctx.height-ctx.margins.bottom;
    var bars = canvas.selectAll(".bar").data(data);
    bars.enter().append("rect").classed("bar",true).merge(bars)
        .attr("x", (d, i) => ctx.x(i))
        .attr("y", d => barbottom-ctx.y(d.value))
        .attr("width", ctx.x.bandwidth())
        .attr("height", d => ctx.y(d.value))
        .attr("fill", (d,i) => d.key==-1?noisecolor:colorScale(d.key))
        .attr("cursor", d => d.key == -1 ? "not-allowed" : undefined)
        .on("mouseover", function (d) {
            tooltip.text("Size: "+d.value+", subclusters: " + _.map(subclustersize_per_cluster[+d.key], (v, k) => v).length);
            return tooltip.style("visibility", "visible");
        })
        .on("mousemove", function () {
            return tooltip.style("top",
                (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })
        .on("mouseout", function () {
            return tooltip.style("visibility", "hidden");
        })
        .on("click", function(d, i, e) {
            if(+d.key === -1) { return; }
            var bar = d3.select(this),
                selected = !bar.classed("selected");

            bar.classed("selected", selected).style("opacity", undefined);

            if(selected) {
                state.selected_clusters.push(+d.key);
                canvas.selectAll(".bar:not(.selected)").style("opacity", 0.3);
            } else {
                _.pull(state.selected_clusters, +d.key);
                bar.style("opacity", 0.3);
                if(state.selected_clusters.length === 0) { canvas.selectAll(".bar").style("opacity", undefined); }
            }

            filter(state);
        })
        .each(function(d, i, e) {
            var cluster = +d.key,
                subcluster_sizes = _.map(subclustersize_per_cluster[cluster], (v, k) => v),
                bottom = barbottom;

            if(subcluster_sizes.length > 1) {
                var x = +d3.select(this).attr("x"),
                    width = +d3.select(this).attr("width");

                subcluster_sizes.sort();
                subcluster_sizes.pop();
                subcluster_sizes.forEach(size => {
                    var y = ctx.y(size);

                    canvas.append("line")
                        .attr("x1", x)
                        .attr("y1", bottom - y)
                        .attr("x2", x + width)
                        .attr("y2", bottom - y)
                        .classed("separator", true)
                        .style("stroke", "white")
                        .style("stroke-width", "2px")
                        .style("stroke-dasharray", "2, 2")

                    bottom -= y;
                });
            }
        });

    bars.exit().remove();

    ctx.y.domain([max,0])
    canvas.select(".xaxis").call(d3.axisBottom(ctx.x).tickFormat(function(d) { return data[d].key==-1?"Noise":d}));

    canvas.select(".yaxis").call(d3.axisLeft(ctx.y).ticks(axisleftticks));

    state.dispatcher.call("drawn");
} // }}}

// setup_jumps {{{
function setup_jumps(state) {
    var canvas = d3.select("#jumps"),
        style = window.getComputedStyle(document.getElementById("jumps")),
        margins = {"left": 55, "right": 55, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Jump paths").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Hover over the bars in the reachability plot to trace the algorithm.")
        .style("font-size", "12px").attr("text-anchor", "middle");

    var x = d3.scaleLinear().range([margins.left, width - margins.right]),
        y = d3.scaleLinear().range([height - margins.bottom, margins.top]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, 0] + ")");

    canvas.append("defs").append("clipPath")
        .attr("id", "clip-jumps")
        .append("svg:rect")
        .attr("width", width - margins.left - margins.right + 5)
        .attr("transform", "translate(" + [margins.left, margins.top] + ")")
        .attr("height", height - margins.top - margins.bottom);

    var zoomarea = canvas.append("g").classed("zoomarea", true).attr("clip-path", "url(#clip-jumps)");

    canvas.append("rect")
        .attr("width", width - margins.left - margins.right)
        .attr("height", height - margins.top - margins.bottom)
        .style("opacity", 0)
        .style("pointer-events", "all")
        .attr("transform", "translate(" + [margins.left, margins.top] + ")")
        .call(d3.zoom().scaleExtent([1, 10]).on("zoom", () => {
            canvas.selectAll(".point, .jumppath").attr("transform", d3.event.transform);

            canvas.selectAll(".point").attr("r", 4 / d3.event.transform.k);
            canvas.selectAll(".jumppath").attr("stroke-width", 1 / d3.event.transform.k)

            var new_x = d3.event.transform.rescaleX(x),
                new_y = d3.event.transform.rescaleY(y);

            canvas.select(".xaxis").call(d3.axisBottom(new_x));
            canvas.select(".yaxis").call(d3.axisLeft(new_y));
        }));

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_jumps(state.output_data, state, ctx);
    state.dispatcher.on("data:change.jumps", data => {
        draw_jumps(data[1], state, ctx);
    });

    state.dispatcher.on("hover:bar", row => {
        var jumppaths = canvas.selectAll(".jumppath");
        if(row === null) { jumppaths.style("stroke-width", null); return; }

        var strokewidth = jumppaths.attr("stroke-width");
        jumppaths.filter(d => d === row).style("stroke-width", 3*strokewidth);
    });
} // }}}

// draw_jumps {{{
function draw_jumps(data, state,ctx) {
    var canvas = d3.select("#jumps"),
        color = d3.scaleSequential(d3.interpolateBlues).domain([0, .004]);

    ctx.x.domain(d3.extent(data, x => x[0])).nice();
    ctx.y.domain(d3.extent(data, x => x[1])).nice();

    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    var points = canvas.select(".zoomarea").selectAll(".point").data(data);

    points.enter()
        .append("circle").classed("point", true).merge(points)
        .attr("cx", d => ctx.x(d[0])).attr("cy", d => ctx.y(d[1]))
        .attr("r", 4)
        .attr("stroke-color", "white")
        .attr("fill", (d) => d.tag==-1?noisecolor:colorScale(d.tag));
    points.exit().remove();

    var jumppaths=canvas.select(".zoomarea").selectAll(".jumppath").data(data);

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
var datacount;
function setup_heat(state) {
    var closecolor="#000066";
    var distantcolor="#E6F3FF";

	var data=state.output_data;

	var style = window.getComputedStyle(document.getElementById("heat")),
        margins = {"left": 20, "right": 80, "top": 50, "bottom": 20},
        width = parseFloat(style.width),
        height = parseFloat(style.height),
        color = d3.scaleLinear()
        //.scalePow().exponent(0.66)
            .interpolate(d3.interpolateRgb)
            .range([d3.rgb(closecolor), d3.rgb(distantcolor)]);

    var innerheight=height-margins.top-margins.bottom;
    var innerwidth=width-margins.left-margins.right;

    var canvas = d3.select("#heat");
    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Symmetric Heat-Map").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Actual distance between Points, ordered by the OPTICS output")
        .style("font-size", "12px").attr("text-anchor", "middle");

    var heatmapcanvas=canvas.append("g").classed("transfromablemap", true).append("svg")
            .classed("heatmapcanvas", true)
            .attr("x", margins.left)
            .attr("y", margins.top)
            .attr("width", innerwidth)
            .attr("height",innerheight)
        ;

    var brush=d3.brush().extent([[0,0],[width,height]]).on("brush", brushed).on("end",brushend);
    var interactioncanvas=canvas.append("g").classed("brushinteraction", true);
    interactioncanvas.call(brush);
    var zoomtransform;
    zoom = d3.zoom()
        .scaleExtent([1, 20])
        .on("zoom", 	function() {
                var e = d3.event;
                zoomtransform=e.transform;
            //TODO:maybe calling this every time is expensive (and useless)
                interactioncanvas.call(brush.move, null);
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

    //canvas.call(zoom);
    var endbrush=false,
        index1, index2;
    function brushed(){

        var s = d3.event.selection;
        if(s===null)return;

        if(endbrush){
            endbrush=false;
            return;}

        var range;
        var transformed;
        if(zoomtransform==null){
            transformed=false;
            range=s;
        }
        else{
            transformed=true;
            range=[zoomtransform.invert(s[0]),zoomtransform.invert(s[1])];
        }

        range[0][0]-=margins.left;
        range[0][1]-=margins.top;
        range[1][0]-=margins.left;
        range[1][1]-=margins.top;
        var rectwidth=innerwidth/datacount;
        var rectheight=innerheight/datacount;

        index1=Math.min((Math.floor(range[0][0]/rectwidth)),(datacount-Math.floor(range[1][1]/rectheight)));
        index1=Math.min(datacount,index1);
        index2=Math.max((Math.floor(range[1][0]/rectwidth)),(datacount-Math.floor(range[0][1]/rectheight)));
        index2=Math.max(0,index2);
        index1=index1<0?0:index1;
        index2=index2>datacount?datacount:index2;
            endbrush=true;
        if(zoomtransform==null){
            interactioncanvas.call(brush.move,
                [ [ ((index1) * rectwidth)+margins.left,(innerheight - ((index2) * (rectheight)))+margins.top],
                    [((index2) * rectwidth)+margins.left,(innerheight - ((index1) * (rectheight)))+margins.top]
                ]);
        }
        else{
            interactioncanvas.call(brush.move,
                [ [ zoomtransform.applyX(((index1) * rectwidth)+margins.left),zoomtransform.applyY((innerheight - ((index2) * (rectheight)))+margins.top)],
                    [zoomtransform.applyX(((index2) * rectwidth)+margins.left),zoomtransform.applyY((innerheight - ((index1) * (rectheight)))+margins.top)]
                ]);
        }
    };

    function brushend(){
        var s = d3.event.selection;
        if(s===null) {
            state.dispatcher.call("select:range", this, null);
        } else {
            state.dispatcher.call("select:range", this, [index1, index2]);
        }
    }

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

    state.dispatcher.on("filter.heat", data => {
        draw_heat(data, state, ctx);
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
    datacount=count;
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
    /*
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
                */

    canvas.select(".yaxis").call(d3.axisRight(ctx.y));

    state.dispatcher.call("drawn");
} // }}}

// setup_scented_widget {{{
function setup_scented_widget(state) {
    var canvas = d3.select("#scented-widget"),
        style = window.getComputedStyle(document.getElementById("scented-widget")),
        margins = {"left": 35, "right": 20, "top": 30, "bottom": 25},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top*2/3)
        .text("Cluster-noise ratio").style("font-weight", "bold").attr("text-anchor", "middle");

    var x = d3.scaleBand().rangeRound([margins.left, width - margins.right]).padding(0.2),
        y = d3.scaleLinear().range([0, height - margins.top -margins.bottom]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, margins.top] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};

    draw_scented_widget(state.output_data, state, ctx);

    state.dispatcher.on("data:change.widget config:changed.widget", data => {
        draw_scented_widget(data[1], state, ctx);
    });
} // }}}

// draw_scented_widget {{{
function draw_scented_widget(data, state, ctx) {
    var canvas = d3.select("#scented-widget"),
        cluster_noise = data.reduce((acc, x) => {
        if(x.tag === -1) {
            acc.noise += 1;
        } else {
            acc.cluster += 1;
        }
        return acc;
    }, { cluster: 0, noise: 0 });

    ctx.x.domain(["cluster", "noise"]);
    ctx.y.domain([0, d3.max([cluster_noise.cluster, cluster_noise.noise])]).nice();

    var bars = canvas.selectAll(".bar").data(_.map(cluster_noise, (v, k) => [k, v]));

    bars.enter()
        .append("rect")
        .classed("bar", true)
        .merge(bars)
        .attr("x", d => ctx.x(d[0]))
        .attr("y", d => ctx.height - ctx.margins.bottom - ctx.y(d[1]))
        .attr("height", d => ctx.y(d[1]))
        .attr("width", ctx.x.bandwidth())
        .attr("fill", d => d[0] === "cluster" ? "blue" : noisecolor);

    bars.exit().remove();

    ctx.y.domain(ctx.y.domain().reverse());
    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));
} // }}}

// setup_dendrogram {{{
// https://bl.ocks.org/mbostock/ff91c1558bc570b08539547ccc90050b
function setup_dendrogram(state) {
    var canvas = d3.select("#dendro"),
        style = window.getComputedStyle(document.getElementById("dendro")),
        margins = {"left": 55, "right": 55, "top": 50, "bottom": 25},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2).attr("y", margins.top / 2)
        .text("Dendrogram").style("font-weight", "bold").attr("text-anchor", "middle");

    canvas.append("text").attr("x", width/2).attr("y", margins.top / 2 + 14).text("Note: only represents first 10 levels, and only those that have more clusters than their predecessor.")
        .style("font-size", "12px").attr("text-anchor", "middle");

    var ctx = { "margins": margins, "width": width, "height": height };
    draw_dendrogram(state.output_data, state, ctx);

    canvas.on("dblclick", () => {
        canvas.transition().duration(750).attr("width", 0).on("end", () => {
            $('.dendrogram-overlay').hide()
            canvas.attr("width", width);
        });
            // $('.dendrogram-overlay').hide()
    });

    state.dispatcher.on("data:change.dendro", data => {
        draw_dendrogram(data[1], state, ctx);
    });

    state.dispatcher.on("toggle:dendrogram", () => {
        canvas.attr("width", 0);
        canvas.transition().duration(750).attr("width", width);
    });
}//}}}

// draw_dendrogram {{{
function draw_dendrogram(data, state, ctx) {
    var canvas = d3.select('#dendro');
    canvas.selectAll("g *").remove();

    var cluster = d3.cluster().size([ctx.height - ctx.margins.top - ctx.margins.bottom, ctx.width - ctx.margins.left - ctx.margins.right]),
        stratify = d3.stratify().parentId(d => d.id.substring(0, d.id.lastIndexOf('.'))),
        hierarchy = generate_hierarchy(data);

    var root = stratify(hierarchy).sort((a, b) => a.height - b.height);
    cluster(root);

    var g = canvas.append("g").attr("transform", "translate(" + [ctx.margins.left, ctx.margins.top] + ")");

    var links = g.selectAll(".link").data(root.descendants().slice(1));
    links.enter()
        .append("path").attr("class", "link").merge(links)
        .attr("d", function(d) {
            return "M" + d.y + "," + d.x
                + "C" + (d.parent.y + 100) + "," + d.x
                + " " + (d.parent.y + 100) + "," + d.parent.x
                + " " + d.parent.y + "," + d.parent.x;
        });

    links.exit().remove();

    var nodes = g.selectAll(".node").data(root.descendants());

    nodes = nodes.enter().append("g")
        .merge(nodes)
        .attr("class", function(d) { return "node level-" + d.data.level; })
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    var circle_range = d3.scaleLinear().range([5, 20]).domain([0, state.output_data.length]),
        color = d3.scaleSequential(d3["interpolate" + interpolator]);

    nodes.append("circle")
        .attr("r", d => circle_range(d.data.count))
        .attr("fill", d => {
            color.domain([0, d.data.total]);
            return color(d.id.substring(d.id.lastIndexOf(".") + 1));
        })
        .style("pointer-events", "none");

    _.range(0, root.height + 1).forEach(level => {
        var min, max, x, cutoff;
        canvas.selectAll(".level-" + level + ' circle').each(d => {
            x = d.y;
            cutoff = d.data.dist;
            if(!min || !max) { min = max = d.x; }
            if(d.x < min) { min = d.x; }
            if(d.x > max) { max = d.x; }
        })

        g.insert("rect", ".node")
            .classed("clustering-group", true)
            .attr("fill", "silver")
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("x", x - 25)
            .attr("y", min - 40)
            .attr("height", max - min + 80)
            .attr("width", 50)
            .style("opacity", 0)
            .on("mouseenter", function() {
                console.log(cutoff);
                d3.select(this).style("opacity", undefined);
            })
            .on("mouseleave", function() {
                d3.select(this).style("opacity", 0);
            })
            .on("click", () => {
                setcutoffs(cutoff, cutoff);
                cutoffchanged(state);
                state.dispatcher.call("select:level");
            });
    });

    nodes.exit().remove();
}//}}}

function do_the_things() {//{{{
    state = {
        dispatcher: d3.dispatch(
            "drawn", "filter", "data:change", "config:changed",
            "select:points", "select:clusters", "select:range", "hover:point",
            "hover:bar", "detail:bandwidth", "size", "select:level",
            "toggle:dendrogram"
        ),
        start: performance.now(),
        thinking: function(n = 5) {
            d3.selectAll(".loading").style("display", undefined);
            $('.loading').show();

            waiter = n;
            this.dispatcher.on("drawn", _e => {
                waiter -= 1;

                if(waiter == 0) {
                    $('.loading').hide();
                    console.log("finished waiting at " + _.round(performance.now() - state.start, 2) + "ms");
                }
            });
        },
        density_map_bandwidth: 20,
        selected_clusters: []
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

        state.thinking();
        compute(data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });

    $("input#bandwidth").on("change", function() {
        state.density_map_bandwidth = +$(this).val();
        $("span#bandwidth-cur").text(state.density_map_bandwidth);
        state.dispatcher.call("detail:bandwidth");
    });

    $("input#minpts").attr("value", minPTS);
    $("span#minpts-cur").text(minPTS);

    $("input#minpts").on("input", function() {
        $("span#minpts-cur").text(+$(this).val());
        if($(this).val() === "") { return; }
        setminPTS(+$(this).val());

        compute(state.input_data, state);
        state.dispatcher.call("config:changed", this, [state.input_data, state.output_data]);
    });

    $("input#minpts").on("change", function() {
        if($(this).val() === "") { return; }
        setminPTS(+$(this).val());

        state.thinking();
        compute(state.input_data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });

    $("input#eps").val(eps);
    $("input#eps").on("change", function() {
        if($(this).val() === "") { return; }
        seteps(+$(this).val());

        state.thinking();
        compute(state.input_data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });

    $("input#eps").on("input", function() {
        if($(this).val() === "") { return; }
        seteps(+$(this).val());

        compute(state.input_data, state);
        state.dispatcher.call("config:changed", this, [state.input_data, state.output_data]);
    })

    $("input#inf").val(maxdist);
    $("input#inf").on("change", function() {
        if($(this).val() === "") { return; }
        setmaxdist(+$(this).val());

        state.thinking();
        compute(state.input_data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });

    $('.tree-button').on('click', () => {
        $('.dendrogram-overlay').toggle();
    });
    // }}}

    state.thinking(5);
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
            setup_scented_widget(state);

            setup_dendrogram(state);

            $("input#minpts").attr("max", state.input_data.length);
            var datalist = $("#minpts-div datalist");
            for(i = 1; i < state.input_data.length; ++i) {
                datalist.append('<option value="' + i + '"' + (i % 5 === 0 ? 'label="' + i + '"' : '') + '>');
            }

            $('.dendrogram-overlay').hide();
    });
}//}}}
// vim: set ts=4 sw=4 tw=0 et :
