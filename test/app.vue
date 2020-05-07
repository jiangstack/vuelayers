<template>
  <div id="app">
    <VlMap
      ref="map"
      data-projection="EPSG:4326">
      <VlView
        ref="view"
        :center.sync="center"
        :rotation.sync="rotation"
        :zoom.sync="zoom" />

      <VlLayerTile>
        <VlSourceOsm />
      </VlLayerTile>

      <VlFeature id="marker">
        <VlGeomCircle
          :coordinates="point"
          :radius="radius" />
        <VlStyle>
          <VlStyleFill color="white" />
          <VlStyleStroke color="green" />
          <VlStyleCircle>
            <VlStyleFill color="white" />
            <VlStyleStroke color="green" />
          </VlStyleCircle>
          <VlStyleText
            text="test"
            font="bold 16px sans-serif">
            <VlStyleFill color="black" />
            <VlStyleStroke color="red" />
            <VlStyleFill
              slot="background"
              color="cyan" />
          </VlStyleText>
        </VlStyle>
      </VlFeature>
    </VlMap>
  </div>
</template>

<script>
  export default {
    name: 'App',
    data () {
      return {
        zoom: 3,
        center: [0, 0],
        rotation: 0,
        point: [0, 0],
        radius: 20,
        extent: [-30, -30, 30, 30],
        features: [],
      }
    },
  }
</script>

<style lang="scss" rel="stylesheet/scss">
  @import "~ol/ol";

  html, body, #app {
    width: 100%;
    height: 100%;
    margin: 0;
    box-sizing: border-box;
    font-family: Helvetica, Arial, sans-serif;
    overflow: hidden;

    * {
      box-sizing: border-box;
    }
  }
</style>
