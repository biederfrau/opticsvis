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

}

// https://bl.ocks.org/mbostock/7f5f22524bd1d824dd53c535eda0187f <- density estimation
// https://bl.ocks.org/skokenes/a85800be6d89c76c1ca98493ae777572 <- lassoing
// setup_density {{{
function setup_density(state) {
    var canvas = d3.select("#density"),
        style = window.getComputedStyle(document.getElementById("density")),
        margins = {"left": 55, "right": 150, "top": 50, "bottom": 35},
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

    canvas.append("g")
        .classed("legend", true)
        .attr("transform", "translate(" + [width - 100, margins.top] + ")");

    canvas.on("dblclick", () => {
        var points = canvas.selectAll(".point");
        points.style("display", points.style("display") == "none" ? null : "none");
    });

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_density(state.output_data, state, ctx);

    state.dispatcher.on("data:change.density", data => {
        draw_density(data[1], state, ctx);
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
        .on("mouseenter", d => { state.dispatcher.call("hover:point", this, d); })
        .on("mouseleave", d => { state.dispatcher.call("hover:point", this, [null, null]); });

    points.exit().remove();

    var legend = d3.legendColor()
        .title("Est. density")
        .shapeWidth(20)
        .shapeHeight(20)
        .cells(Math.floor((ctx.height - ctx.margins.bottom - ctx.margins.top) / 25))
        .orient("vertical")
        .labelFormat(d3.format(".04f"))
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

//TODO: adjust x tickmarks
    var x = d3.scaleBand().rangeRound([margins.left, width - margins.right]).padding(0.2);
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

    state.dispatcher.on("select:points.reach", points => {
        var bars = canvas.selectAll(".bar");
        if(points.length == 0) { bars.classed("not-highlighted", false); return; }

        bars.classed("not-highlighted", true);
        bars.filter(d => _.find(points, x => x[0] == d[0] && x[1] == d[1])).classed("not-highlighted", false);
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
        //TODO: cleanup
        if(d3.event.y<ctx.margins.top)d3.event.y=ctx.margins.top;
        if(d3.event.y>ctx.height-ctx.margins.bottom)d3.event.y=ctx.height-ctx.margins.bottom;
        if(d3.event.y>scutoff2){
            moveable2.attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
            scutoff2=d3.event.y;
        }
        d3.select(this).attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
        scutoff1=d3.event.y;
        setcutoffs(ctx.y.invert(scutoff1-ctx.margins.top),ctx.y.invert(scutoff2-ctx.margins.top));
        cutoffchanged();
    }

    function dragged2(d) {
        //TODO: cleanup
        if(d3.event.y<ctx.margins.top)d3.event.y=ctx.margins.top;
        if(d3.event.y>ctx.height-ctx.margins.bottom)d3.event.y=ctx.height-ctx.margins.bottom;
        if(d3.event.y<scutoff1){
            moveable1.attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
            scutoff1=d3.event.y;
        }
        d3.select(this).attr("transform", "translate(" + [ctx.margins.left, d3.event.y] + ")");
        scutoff2=d3.event.y;
        setcutoffs(ctx.y.invert(scutoff1-ctx.margins.top),ctx.y.invert(scutoff2-ctx.margins.top));
        cutoffchanged();
    }

    function cutoffchanged(){
        reCalculateClusters();
        state.clustersizes= getClusterSizes(state.output_data);
        colorScale.domain([0, state.clustersizes.length-1]);

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
            state.dispatcher.call("hover:bar", this, d);
            tooltip.text("Reachability Distance: "+d.distance);
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

    var barbottom=ctx.height-ctx.margins.bottom;
    var bars = canvas.selectAll(".bar").data(data);
    bars.enter().append("rect").classed("bar",true).merge(bars)
        .attr("x", (d, i) => ctx.x(i))
        .attr("y", d => barbottom-ctx.y(d.value))
        .attr("width", ctx.x.bandwidth())
        .attr("height", d => ctx.y(d.value))
        .attr("fill", (d,i) => d.key==-1?noisecolor:colorScale(d.key))
        .on("mouseover", function (d) {
            tooltip.text("Size: "+d.value);
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
        jumppaths.filter(d => d === row).style("stroke-width", "3px");
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



    canvas.call(zoom);
    var endbrush=false;
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

        var index1=Math.min((Math.floor(range[0][0]/rectwidth)),(datacount-Math.floor(range[1][1]/rectheight)));
        index1=Math.min(datacount,index1);
        var index2=Math.max((Math.floor(range[1][0]/rectwidth)),(datacount-Math.floor(range[0][1]/rectheight)));
        index2=Math.max(0,index2);
        index1=index1<0?0:index1;
        index2=index2>datacount?datacount:index2;
        console.log(index1);
        console.log(index2);
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


        //TODO: set highlight index1=first selected index && index2-1=last selected index
        //TODO: if(index1>index2-1)=> nothing selected/invalid selection


    };

    function brushend(){
        var s = d3.event.selection;
        if(s===null) {
            console.log("brush removed");
            //TODO:remove highlights
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
        dispatcher: d3.dispatch("drawn", "filter", "data:change", "select:points", "select:clusters", "hover:point", "hover:bar", "detail:bandwidth", "size"),
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
        density_map_bandwidth: 20
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
    });

    $("input#minpts").on("change", function() {
        if($(this).val() === "") { return; }
        setminPTS(+$(this).val());
        compute(state.input_data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });

    $("input#eps").val(eps);
    $("input#eps").on("change", function() {
        if($(this).val() === "") { return; }
        seteps(+$(this).val());
        compute(state.input_data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });

    $("input#inf").val(maxdist);
    $("input#inf").on("change", function() {
        if($(this).val() === "") { return; }
        setmaxdist(+$(this).val());
        compute(state.input_data, state);
        state.dispatcher.call("data:change", this, [state.input_data, state.output_data]);
    });
    // }}}

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

            $("input#minpts").attr("max", state.input_data.length);
            var datalist = $("#minpts-div datalist");
            for(i = 1; i < state.input_data.length; ++i) {
                datalist.append('<option value="' + i + '"' + (i % 5 === 0 ? 'label="' + i + '"' : '') + '>');
            }
    });
}//}}}
// vim: set ts=4 sw=4 tw=0 et :
