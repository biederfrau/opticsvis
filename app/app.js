function compute(state) {

}

function filter(state) {

}

function setup_density(state) {

}

function draw_density(data, state) {

    state.dispatcher.call("drawn");
}

function setup_reach(data, state) {

}

function draw_reach(data, state) {

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

}

function draw_heat(data, state) {

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

    $(".ui-bar *").click(function(e) {
        this.toggleClass("toggled");
    });

    // ui crap {{{
    $("#about-input").click(e => {
        $("#about-input").toggleClass("toggled");
        $(".ui-bar").toggleClass("toggled");
        $(".ui-bar .about-entry").toggleClass("toggled");
    });

    $("#data-input").click(e => {
        $("#data-input").toggleClass("toggled");
        $(".ui-bar").toggleClass("toggled");
        $(".ui-bar .data-entry").toggleClass("toggled");
    });

    $("#data-form").submit(e => {
        state.data = $("#data-textarea").val().split("\n")
            .map(_.trim).filter(line => line !== "")
            .map(x => x.split(" ")).map(x => x.map(parseFloat));
    });//}}}
}//}}}
// vim: set ts=4 sw=4 tw=0 et :
