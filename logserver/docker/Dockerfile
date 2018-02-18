FROM phusion/baseimage:0.10.0

# Use baseimage-docker's init system.
CMD ["/sbin/my_init"]

RUN mkdir /etc/service/brewerynode

ADD run /etc/service/brewerynode/run
ADD brewerynode /usr/local/bin/brewerynode


# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
