(function($){
  $(function(){
    $('.button-collapse').sideNav();
    if ($.fn && typeof $.fn.modal === 'function') {
      $('.modal').modal();
    }
  }); // end of document ready
})(jQuery); // end of jQuery name space

// //svg animation
// $(document).ready(function() {
//   var tmax_tl = new TimelineMax({
//       delay: 2,
//       repeat: 0,
//       repeatDelay: 2
//     }),

//     svg_shapes = $('#logo'),
//     stagger_val = 0.00125,
//     duration = 1.5,

//     stagger_opts_from = {
//       css: {
//         opacity: 0,
//         transform: 'translate(0px, 50px) rotate(0deg) scale(1)',
//         transformOrigin: 'center center'
//       },
//       ease: Elastic.easeInOut
//     },

//     stagger_opts_to = {
//       css: {
//         opacity: 1,
//         transform: 'translate(0px) rotate(0deg) scale(1.2)'
//       },
//       ease: Elastic.easeInOut
//     };

//   tmax_tl.staggerFromTo(
//     svg_shapes,
//     duration,
//     stagger_opts_from,
//     stagger_opts_to,
//     stagger_val,
//     0
//   );
// });

//On clicking the mooments button on projects page, change to moments tab
$(".moments-btn").click(function() {
    $('ul.tabs').tabs('select_tab', 'moments');
});

//On clicking the work button on projects page, change to work tab
$(".work-btn").click(function() {
    $('ul.tabs').tabs('select_tab', 'work');
});

//carousel width
$('.carousel.carousel-slider').carousel({full_width: true});

//carousel next slide
var nextslide = function(){
    $('.carousel').carousel('next');
}

//smooth-scrolling
$("#work-link").click(function() {
  $('html, body').animate({
      scrollTop: $("#scroll-to-work").offset().top
  }, 800);
});

var figure = $(".video").hover( hoverVideo, hideVideo );
function hoverVideo(e) {  
    $(this).get(0).play(); 
}

function hideVideo(e) {
    $(this).get(0).pause(); 
}


//show password field
var showpsswrd = function() {
  $(".psswrd").show();
  // window.location.href="#psswrd-scroll";
};

// validate password
var validatepsswrd = function(event) {

  if (event.keyCode == 13) {

    event.preventDefault();

    var type = $(event.currentTarget).data("type");

    if (type == "bundles") {
      var input = $("#password");
    } else if (type == "promotions") {
      var input = $("#password-promo");
    } else if (type == "pangea") {
      var input = $("#password-pangea");
    }

    var txt = input.val();
    var project = input.data("project");

    if(txt == "access2017") {
      input.addClass("valid");
      window.open(project, '_blank');
      
      $(".psswrd").hide();
      $(".access-link").hide();

      input.removeClass("invalid");
    
    } else if(!(txt == "access2017") && event.keyCode == 13) {
      
      $(".access-link").show();
      input.addClass("invalid");

      $("input[type=password] + label.active").css("color", "#f44336 !important");

    }
  }
};

// Enhance project moments galleries with simple navigation and motion.
(function () {
  function getActiveIndex(gallery, items) {
    var gRect = gallery.getBoundingClientRect();
    var center = gRect.left + gRect.width / 2;
    var active = 0;
    var minDistance = Infinity;

    items.forEach(function (item, index) {
      var rect = item.getBoundingClientRect();
      var itemCenter = rect.left + rect.width / 2;
      var distance = Math.abs(center - itemCenter);
      if (distance < minDistance) {
        minDistance = distance;
        active = index;
      }
    });

    return active;
  }

  function setupMomentsGallery(gallery) {
    var items = Array.prototype.slice.call(gallery.querySelectorAll('.moments-item'));
    if (items.length < 2) {
      return;
    }

    gallery.classList.add('moments-gallery-enhanced');
    gallery.setAttribute('tabindex', '0');

    var hint = document.createElement('p');
    hint.className = 'moments-swipe-hint';
    hint.textContent = 'Swipe cards or use arrows';
    gallery.parentNode.insertBefore(hint, gallery);

    var nav = document.createElement('div');
    nav.className = 'moments-nav';

    var prev = document.createElement('button');
    prev.className = 'moments-nav-btn';
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous moment');
    prev.innerHTML = '<span class="material-icons" aria-hidden="true">chevron_left</span>';

    var dots = document.createElement('div');
    dots.className = 'moments-dots';

    var next = document.createElement('button');
    next.className = 'moments-nav-btn';
    next.type = 'button';
    next.setAttribute('aria-label', 'Next moment');
    next.innerHTML = '<span class="material-icons" aria-hidden="true">chevron_right</span>';

    nav.appendChild(prev);
    nav.appendChild(dots);
    nav.appendChild(next);
    gallery.parentNode.insertBefore(nav, gallery.nextSibling);

    var dotButtons = items.map(function (_, index) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'moments-dot';
      dot.setAttribute('aria-label', 'Go to moment ' + (index + 1));
      dot.addEventListener('click', function () {
        items[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
      dots.appendChild(dot);
      return dot;
    });

    function updateUI() {
      var active = getActiveIndex(gallery, items);
      dotButtons.forEach(function (dot, index) {
        dot.classList.toggle('is-active', index === active);
      });
      prev.disabled = active <= 0;
      next.disabled = active >= items.length - 1;
    }

    function moveBy(delta) {
      var active = getActiveIndex(gallery, items);
      var target = Math.max(0, Math.min(items.length - 1, active + delta));
      items[target].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    prev.addEventListener('click', function () { moveBy(-1); });
    next.addEventListener('click', function () { moveBy(1); });
    gallery.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveBy(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveBy(1);
      }
    });

    var scheduled = false;
    gallery.addEventListener('scroll', function () {
      if (scheduled) {
        return;
      }
      scheduled = true;
      window.requestAnimationFrame(function () {
        updateUI();
        scheduled = false;
      });
    }, { passive: true });

    window.addEventListener('resize', updateUI);
    updateUI();

    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    items.forEach(function (item) {
      item.style.opacity = '0';
      item.style.transform = 'translateY(16px) scale(0.98)';
    });

    var dynamicImport = null;
    try {
      dynamicImport = new Function('u', 'return import(u)');
    } catch (e) {
      dynamicImport = null;
    }

    function fallbackAnimate() {
      items.forEach(function (item, index) {
        setTimeout(function () {
          item.style.transition = 'opacity 380ms cubic-bezier(.22,1,.36,1), transform 380ms cubic-bezier(.22,1,.36,1)';
          item.style.opacity = '1';
          item.style.transform = 'translateY(0) scale(1)';
        }, index * 70);
      });
    }

    if (!dynamicImport) {
      fallbackAnimate();
      return;
    }

    dynamicImport('https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm')
      .then(function (mod) {
        if (!mod || typeof mod.animate !== 'function') {
          fallbackAnimate();
          return;
        }
        mod.animate(items, {
          opacity: [0, 1],
          y: [18, 0],
          scale: [0.98, 1]
        }, {
          duration: 0.45,
          delay: mod.stagger ? mod.stagger(0.06) : 0,
          easing: [0.22, 1, 0.36, 1]
        });
      })
      .catch(function () {
        fallbackAnimate();
      });
  }

  function setupMomentsGalleries() {
    var galleries = document.querySelectorAll('.moments-gallery');
    if (!galleries.length) {
      return;
    }
    galleries.forEach(setupMomentsGallery);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMomentsGalleries);
  } else {
    setupMomentsGalleries();
  }
})();
