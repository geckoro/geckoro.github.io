function scale(number, inMin, inMax, outMin, outMax) {
  return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

$("#button-clouds").on("click", function () {
  window.location.href = "pages/clouds.html";
});

$("#button-quiz").on("click", function () {
  window.location.href = "pages/quiz.html";
});

$(function () {
  $(document).mousemove(function (event) {
    $('.circle').css('width', '1000px');
    $('.circle').css('height', '1000px');
    let dimension = $(".circle").width();
    $('.circle').css('left', event.pageX - dimension / 2);
    $('.circle').css('top', event.pageY - dimension / 2);
    let r = scale(event.pageX, 0, $(window).width(), 0, 255);
    let g = scale(event.pageY, 0, $(window).height(), 255, 0);
    let b = scale(event.pageX, 0, $(window).width(), 255, 0);
    $('.circle').css('background-image', 'radial-gradient(50% 30%, rgba(' + r + ',' + g + ',' + b + ', 0.1), rgba(0,0,0,0)');
  });
});