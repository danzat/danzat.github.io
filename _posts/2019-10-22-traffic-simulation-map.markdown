---
layout: post
title:  "Traffic Simulator"
subtitle: "Preparation"
date:   2019-10-22
categories: algorithms simulation
---

As I'm writing this blog about something I did almost 3 years ago, I'm having some trouble remembering the exact circumstances that led me to simulate traffic in a city. However, the general direction was that I was interested in measuring how certain parameters (speed-limit, driver reaction-time, vehicle density etc...) effect congestion (and btw, the definition of congestion is also not trivial).

So, the basic idea is to have some representation of a map - a graph of streets with various metadata, and on this map, vehicles would spawn, and follow some simple rules that model a driver (accelerate to meet the speed limit, decelerate/break when entering a junction or in response to a vehicle in front).

To start, I needed a playing field - a map. So I went to [OpenStreetMap](https://www.openstreetmap.org/) a pulled a map file of the Tel-Aviv area.

# Parsing the map

The file is an XML file, and is pretty huge relative to the size of the area it represents. Mainly as it contains a lot of information that's not relevant to the simulation (street names, buildings etc...).

What I really need (initially) are coordinates of streets. This can be obtained by parsing the `<node>` tags:

```xml
<node id="139698" lat="32.0938800" lon="34.7912317" version="19" timestamp="2011-12-12T17:34:51Z" changeset="10101015" uid="385027" user="Ori952"/>
```

What we care about are the node's `id`, `lon` (longitude) and `lat` (latitude). Which can be parsed and stored into `nodes` like this:

```python
with open('map.osm', 'rU') as xml_file:
    tree = etree.parse(xml_file)
    root = tree.getroot()
    nodes = {}
    ways = []
    for child in root:
        if child.tag == 'node':
            lon = float(child.get('lon'))
            lat = float(child.get('lat'))
            nodes[child.get('id')] = (lon, lat, )
```

The next type of information we need are the actual streets that connect the nodes. Those are represented by `<way>` tags:

```xml
<way id="5013379" version="16" timestamp="2014-11-15T12:53:09Z" changeset="26797570" uid="331840" user="yrtimiD">
    <nd ref="1628415541"/>                                                                                                                                                                       <nd ref="2470788072"/>
    <nd ref="2109540860"/>
    <tag k="highway" v="pedestrian"/>
    <tag k="int_name" v="Nahalat Binyamin"/>
    <tag k="motor_vehicle" v="no"/>
    <tag k="name" v="נחלת בנימין"/>
    <tag k="name:en" v="Nachalat Biniamin"/>
    <tag k="name:he" v="נחלת בנימין"/>
</way>
```

Initially, what we need is just the list of node ids that compose the road. However, there are two important points:

* Not all `<way>`s represent vehicle roads. This is determined by the `v` (value) property of the `<tag>` whose `k` (key) is `highway`:

  ```python
  NON_ROAD_TYPES = ['proposed', 'platform', 'path', 'footway', 'pedestrian',
          'cycleway', 'road', 'steps', 'track', 'unclassified', 'construction']
  def way_of_road(way):
      for child in way:
          if child.tag == 'tag' and child.get('k') =='highway':
              if child.get('v') in NON_ROAD_TYPES:
                  return False
              return True
      return False
  ```

* Some roads are two-way. As our graph will be directed, we need to manually add the arcs in the opposite direction.

Eventually we can parse the road data into the `ways` list using:

```python
for child in root:
    if child.tag == 'way':
        way = child
    if not way_of_road(way):
        continue
    nds = []
    for nd in way:
        if nd.tag == 'nd':
            nds.append(nd.get('ref'))
    ways.append((nds, speed))
    if two_way_road(way):
        ways.append((list(reversed(nds)), speed))
```

Now, we're almost there, as we have a list of "ways" which are themselves lists of nodes. But what we actually need is arcs, which are tuples of consecutive nodes:

```python
ref_arcs = []
for way in ways:
    arc_tuples = zip(way[:-1], way[1:])
    ref_arcs.extend((src, dst) for src, dst in arc_tuples)
```

# Refining

If you think about it, the map file we use is a cropped map. So what would happen is that we will have lots of roads that leave or exit the map that are dead-end. If we don't want our map to have car sinks, we need to eliminate all those dead-ends:

```python
while True:
    src_set = set(src for src, _, _ in ref_arcs)
    _ref_arcs = []
    discarded = False
    for src, dst, speed in ref_arcs:
        if dst in src_set:
            _ref_arcs.append((src, dst, speed))
        else:
            discarded = True
    # If no arcs were discarded in this round we are done
    if not discarded:
        break
    ref_arcs = _ref_arcs
```

# Coordinates

The node coordinates are all angular - longitude and latitude. However, on the ground, vehicles are moving at km/h (or m/s). We have no way of running the simulation without assigning fixed coordinated to the nodes.

There is an entire science to measuring the earth. But I wanted to choose something simple.

Basically what I did was take the lon/lat bounding box the of map, imagine there's a tangent surface to the earth at the center of that box, and then project the nodes onto that surface. This way I can have a 2-dimensional coordinate system on that surface which I can use as east/north coordinates,

So, first, I want to convert lon/lat coordinates to a 3d point on the surface of earth's sphere. These are just [Spherical Coordinates](https://en.wikipedia.org/wiki/Spherical_coordinate_system#Cartesian_coordinates)

```python
def vector3_from_lon_lat(lon, lat):
    l = lon * math.pi / 180
    p = lat * math.pi / 180

    return (math.cos(p) * math.cos(l), math.cos(p) * math.sin(l), math.sin(p))
```

What this would give us is the normal to the tangent plane.

Now we need the north and east facing unit-vectors on the plane so we can use them as basis vectors:

```python
# Bounding box
minlon = min(lon for lon, lat in nodes.values())
maxlon = max(lon for lon, lat in nodes.values())
minlat = min(lat for lon, lat in nodes.values())
maxlat = max(lat for lon, lat in nodes.values())

# Center point
lon_0 = (minlon + maxlon) / 2
lat_0 = (minlat + maxlat) / 2

n_0 = vector3_from_lon_lat(lon_0, lat_0)

z = (0, 0, 1) # "real" north: points to the north pole

north_0 = sub3(z, scale3(n_0, dot3(z, n_0))) # Project north onto the tangent plane
north_0 = scale3(north_0, 1 / norm3(north_0)) # Normalize

east_0 = cross3(north_0, n_0) # Right-hand rule
```

Now for each lon/lat coordinate, we scale it using earth's radius (6.317e6[m]) towards the plane and then find the decompose to our north and south:

```python
n = vector3_from_lon_lat(lon, lat)
t = R_E / dot3(n, n_0)
x = scale3(n, t)
u = dot3(x, north_0)
v = dot3(x, east_0)
```

That's it so far, then time we'll talk about setting up a simulation.
