#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use Plack::Builder;
use Plack::Debugger;

my $debugger = Plack::Debugger->new(
    data_dir => './share',
    panels   => [
        Plack::Debugger::Panel->new(
            title     => 'Timer',
            subtitle  => '',
            before    => sub { (shift)->context( time ) },
            after     => sub { 
                my $self = shift;
                $self->result( time - $self->context ); 
            },
        )
    ]
);


my $app = sub {
    [ 200, [], [ 'HELLO WORLD' ]]
};


builder {
    mount '/debugger' => Plack::App::Debugger->new( debugger => $debugger )->to_app;

    mount '/' => sub {
        enable 'Plack::Middleware::Debugger::Collector' => ( debugger => $debugger );
        enable 'Plack::Middleware::Debugger::Injector'  => ( debugger => $debugger );
        $app;
    };
};

## OR ...

builder {
    mount '/debugger' => $debugger->application->to_app;

    mount '/' => sub {
        enable $debugger->collector->to_app;
        enable $debugger->injector->to_app;
        $app;
    };
};

pass('... just checking');

done_testing;







