var eps = 40;
var minPTS = 4;
var maxdist = 60;
var distbetween;
var cutoff1=20;
var cutoff2=cutoff1;
var clusterOrderSave;
var dim1 = 0, dim2 = 1;
var totaldims=2;

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
    cutoff1=newcutoff;
    cutoff2=newcutoff;
}
function setcutoffs(newcutoff1,newcutoff2) {
    cutoff1=newcutoff1;
    cutoff2=newcutoff2;
}
function setcutoff1(newcutoff) {
    cutoff1=newcutoff;
}
function setcutoff2(newcutoff) {
    cutoff2=newcutoff;
}


function getClusterOrder(){
    return clusterOrderSave;
};

function getcutoff1(){return cutoff1;}
function getcutoff2(){return cutoff2;}

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

    calculateClusters(clusterOrder);
    clusterOrder.forEach((p, i) => p.idx = i);

    return clusterOrder;
}

function reCalculateClusters(){
    calculateClusters(clusterOrderSave);
}

function calculateClusters(clusterOrder) {
    if(cutoff1==cutoff2) {
        var clusterer = [];
        var datalength = clusterOrder.length;
        var curindex = 0;
        clusterer[0] = 1;
        clusterOrder[0].subtag=0;
        for (var i = 1; i < datalength; ++i) {
            clusterOrder[i].subtag=0;
            if (clusterOrder[i].distance > cutoff1) {
                clusterer[++curindex] = 0;
            }
            ++clusterer[curindex];
        }
        tag(clusterOrder, clusterer);
    }
    else{
        var clusterer1 = [];
        var clusterer2 = [];
        var datalength = clusterOrder.length;
        var curindex1 = 0;
        var curindex2 = 0;
        clusterer1[0] = 1;
        clusterer2[0] = 1;
        for (var i = 1; i < datalength; ++i) {
            if (clusterOrder[i].distance > cutoff1) {
                clusterer1[++curindex1] = 0;
            }
            if (clusterOrder[i].distance > cutoff2) {
                clusterer2[++curindex2] = 0;
            }
            ++clusterer1[curindex1];
            ++clusterer2[curindex2];
        }
        tag2(clusterOrder, clusterer1,clusterer2);
    }
}

function  tag(clusterOrder,clusterer){
    var noise=0;
    var index=0;
    for(var i=0;i<clusterer.length;++i) {
        if (clusterer[i] == 1) {
            noise++;
            clusterOrder[index++].tag=-1;
        }
        else {
            var count=clusterer[i];
            for(var j=0;j<count;++j)
                clusterOrder[index++].tag=i-noise;
        }
    }
    clusterOrderSave=clusterOrder;
}

function  tag2(clusterOrder,clusterer1,clusterer2){
    var noise=0;
    var index=0;
    for(var i=0;i<clusterer1.length;++i) {
        if (clusterer1[i] == 1) {
            noise++;
            clusterOrder[index++].tag=-1;
        }
        else {
            var count=clusterer1[i];
            for(var j=0;j<count;++j)
                clusterOrder[index++].tag=i-noise;
        }
    }

    var noise2=0;
    var retag=0;
    var oldtag=-1;
    index=0;
    for(var i=0;i<clusterer2.length;++i) {
        if (clusterer2[i] == 1) {
            if(oldtag!=clusterOrder[index].tag){retag=i; noise2=0}
            else{noise2++;}
            clusterOrder[index].subtag=-1;
            oldtag=clusterOrder[index].tag
            ++index;
        }
        else {
            var count=clusterer2[i];
            if(oldtag!=clusterOrder[index].tag){retag=i; noise2=0}
            for(var j=0;j<count;++j) {
                clusterOrder[index].subtag = i - noise2 - retag;
                ++index;
            }
            if(index<clusterOrder.length){
            oldtag=clusterOrder[index].tag}
        }
    }

    clusterOrderSave=clusterOrder;
}

function coredist(distances, minPTS) {
    //TODO: maybe this can somehow be improved?
    var lowerbound = -1;
    var smalest = Number.MAX_VALUE;
    var count = 0;
    var count2=0;
    for (var i = 0; i < minPTS - 1; i++) {
        for (var j = 0; j < distances.length; j++) {
            var distance = distances[j];
            if (distance < smalest && distance > lowerbound) {
                smalest = distance;
                count = 1;
            }
            else if (distance == lowerbound) count++;
        }
        //if (i + count >= minPTS - 1) return smalest;
        count2+=count;
        if(count2 > minPTS-1)return  smalest;
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

function euclidian(a, b) {
    return Math.sqrt((a[dim1] - b[dim1])**2 + (a[dim2] - b[dim2])**2);
}

function euclidianall(a, b) {
    var dist=0;
    for(var i=0;i<totaldims;++i){
        dist+=(a[i] - b[i])**2
    }
    return Math.sqrt(dist);
}

function manhattan(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

distbetween=euclidian;
