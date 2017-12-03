var eps = 40;
var minPTS = 4;
var maxdist = 60;
var distbetween;
var cutoff=25;
var clustersizes;
var clusterOrderSave;

function seteps(neweps){
    eps=neweps;
}
function setminPTS(newminPTS){
    minPTS=newminPTS;
}
function setmaxdist(newmaxdist){
    maxdist=newmaxdist;
}
function setdistbetween(newdistbetween) {
    distbetween=newdistbetween;
}
function setcutoff(newcutoff) {
    cutoff=newcutoff;
}

function getClusterSizes() {
    return clustersizes;
}

function getClusterOrder(){
    return clusterOrderSave;
};

//TODO maybe there is a better way?
Array.prototype.contains = function (obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
};



function optics(input) {

    var seedlist = [];
    var clusterOrder = [];
    var minvalid = 0;
    var totalcount = input.length;
    for (var i = 0; i < totalcount; i++) {
        input[i].flag = false;
        input[i].distance = maxdist;
        input[i].from=-1;
    }
    for (var i = 0; i < totalcount; i++) {
        var current = null;
        if (seedlist.length == 0) {
            for (var j = minvalid; j < totalcount; j++) {
                minvalid++;
                if (!input[j].flag) {
                    current = input[j];
                    break;
                }
            }
        }
        else {
            current = seedlist[0];
            seedlist.splice(0, 1);
        }

        if (current != null) {
            clusterOrder.push(current);
            current.flag = true;
            var distances = [];
            var neighbours = query(input, eps, current, distances);
            if (neighbours.length + 1 >= minPTS) {
                var coredistance = coredist(distances, minPTS);
                for (var j = 0; j < neighbours.length; j++) {
                    var neighbour = neighbours[j];
                    if (!neighbour.flag) {
                        var dist = Math.max(distances[j], coredistance);
                        if ((neighbour.distance) > dist){
                            neighbour.distance = dist;
                            //from where did we jump here
                            neighbour.from=i;
                        }
                        //TODO: there may be a better check for this?
                        if (!seedlist.contains(neighbour)) seedlist.push(neighbour);
                    }
                }

                //TODO: a min heap would save us sorting every itteration maybe consider this (or some ordered list)
                //TODO: for the seedlist
                if (seedlist.length > 1) {
                    var minval = Number.MAX_VALUE;
                    var index = -1;
                    for (var y = 0; y < seedlist.length; y++) {
                        if (seedlist[y].distance < minval) {
                            index = y;
                            minval = seedlist[y].distance;
                        }
                    }
                    var temp = seedlist[0];
                    seedlist[0] = seedlist[index];
                    seedlist[index] = temp;
                }
            }
        }

    }
    calculateClusters(clusterOrder);
    return clusterOrder;
}

function calculateClusters(clusterOrder) {
    clusterer=[];
    var datalength= clusterOrder.length;
    var curindex=0;
    clusterer[0]=1;
    for(var i=1;i<datalength;++i) {
        if (clusterOrder[i].distance > cutoff) {
            clusterer[++curindex] = 0;
        }
        ++clusterer[curindex];
    }
    tag(clusterOrder,clusterer);
}

function  tag(clusterOrder,clusterer){
    var curindex=0;
    var clusters=[];
    var noise=0;
    var index=0;
    for(var i=0;i<clusterer.length;++i) {
        if (clusterer[i] == 1) {
            noise++;
            clusterOrder[index++].tag=-1;
        }
        else {
            clusters[curindex++] = clusterer[i];
            var count=clusterer[i];
            for(var j=0;j<count;++j)
                clusterOrder[index++].tag=i-noise;
        }
    }
    clusters[curindex]=noise;
    clustersizes=clusters;
    clusterOrderSave=clusterOrder;
}

function coredist(distances, minPTS) {
    //TODO: maybe this can somehow be improved?
    var lowerbound = -1;
    var smalest = distances[0];
    var count = 1;
    for (var i = 0; i < minPTS - 1; i++) {
        for (var j = 0; j < distances.length; j++) {
            var distance = distances[j];
            if (distance < smalest && distance > lowerbound) {
                smalest = distance;
                count = 1;
            }
            else if (distance == lowerbound) count++;
        }
        if (i + count >= minPTS - 1) return smalest;
        count = 0;
        lowerbound = smalest;
        smalest = Number.MAX_VALUE;
    }

    return lowerbound;
}

function query(input, range, start, distances) {
    // TODO this can maybe be improved?
    var result = [];
    input.forEach(function (p,i) {
        var distance = distbetween(p, start);
        if (distance <= range && p !== start) {
            result.push(p);
            distances.push(distance);
        }
    });
    return result;

}

distbetween=function(a, b) {
    //TODO: maybe change this?
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}